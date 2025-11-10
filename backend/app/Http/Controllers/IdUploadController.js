const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const heicConvert = require('heic-convert');
const IdOcrJob = require('../../Jobs/IdOcrJob');
const IdentityDocument = require('../../Models/IdentityDocument');

class IdUploadController {
    constructor() {
        this.ocrJobs = new Map(); // In-memory job storage for backwards compatibility
    }

    /**
     * Upload and process ID document
     */
    async upload(req, res) {
        try {
            if (!req.file) {
                return res.status(422).json({
                    success: false,
                    error: 'No file uploaded'
                });
            }

            const file = req.file;
            const userId = req.user?.id || 'demo-user'; // From auth middleware

            // Validate file was stored successfully
            if (!file.path) {
                return res.status(500).json({
                    success: false,
                    error: 'File storage failed'
                });
            }

            let processedFilePath = file.path;
            let originalFilename = file.originalname;

            // Convert HEIC to JPEG if needed
            if (file.mimetype === 'image/heic' || file.originalname.toLowerCase().endsWith('.heic')) {
                try {
                    processedFilePath = await this.convertHeicToJpeg(file.path, file.filename);
                    originalFilename = originalFilename.replace(/\.heic$/i, '.jpg');
                } catch (error) {
                    console.error('HEIC conversion failed:', error);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to convert HEIC file to JPEG'
                    });
                }
            }

            // Generate job ID and dispatch OCR job
            const jobId = `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create initial database record
            try {
                await IdentityDocument.create({
                    jobId: jobId,
                    userId: userId,
                    filePath: processedFilePath,
                    originalFileName: originalFilename,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    status: 'pending'
                });
                console.log(`✅ Created database record for job ${jobId}`);
            } catch (dbError) {
                console.warn('⚠️  Failed to create database record, using in-memory storage:', dbError.message);
            }

            // Store job information in memory (backwards compatibility)
            this.ocrJobs.set(jobId, {
                id: jobId,
                userId: userId,
                status: 'pending',
                filePath: processedFilePath,
                originalName: originalFilename,
                fileSize: file.size,
                mimeType: file.mimetype,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Dispatch OCR job
            const ocrJob = new IdOcrJob(processedFilePath, userId, jobId);
            ocrJob.handle()
                .then(async result => {
                    // Update job status in database
                    try {
                        await IdentityDocument.findOneAndUpdate(
                            { jobId: jobId },
                            {
                                status: 'completed',
                                extractedData: result.data,
                                overallConfidence: result.confidence,
                                processedAt: new Date()
                            }
                        );
                    } catch (dbError) {
                        console.warn('⚠️  Failed to update database record:', dbError.message);
                    }

                    // Update in-memory storage (backwards compatibility)
                    const job = this.ocrJobs.get(jobId);
                    if (job) {
                        job.status = 'completed';
                        job.extractedData = result.data;
                        job.confidenceScore = result.confidence;
                        job.processedAt = new Date();
                        job.updatedAt = new Date();
                    }
                })
                .catch(async error => {
                    // Update job status in database
                    try {
                        await IdentityDocument.findOneAndUpdate(
                            { jobId: jobId },
                            {
                                status: 'failed',
                                errorMessage: error.message
                            }
                        );
                    } catch (dbError) {
                        console.warn('⚠️  Failed to update database record:', dbError.message);
                    }

                    // Update in-memory storage (backwards compatibility)
                    const job = this.ocrJobs.get(jobId);
                    if (job) {
                        job.status = 'failed';
                        job.error = error.message;
                        job.updatedAt = new Date();
                    }
                });

            return res.json({
                success: true,
                data: {
                    job_id: jobId,
                    file_path: processedFilePath,
                    original_name: originalFilename,
                    file_size: file.size,
                    mime_type: file.mimetype,
                    message: 'File uploaded successfully. OCR processing started.'
                }
            });

        } catch (error) {
            console.error('Upload Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Upload failed. Please try again.'
            });
        }
    }

    /**
     * Get OCR job status
     */
    async getStatus(req, res) {
        try {
            const { jobId } = req.params;
            const userId = req.user?.id || 'demo-user';

            // Try to get from database first
            let job = null;
            try {
                const dbJob = await IdentityDocument.findOne({ jobId: jobId, userId: userId });
                if (dbJob) {
                    job = {
                        id: dbJob.jobId,
                        status: dbJob.status,
                        createdAt: dbJob.createdAt,
                        updatedAt: dbJob.updatedAt
                    };
                }
            } catch (dbError) {
                console.warn('⚠️  Database query failed, using in-memory storage:', dbError.message);
            }

            // Fallback to in-memory storage
            if (!job) {
                const memJob = this.ocrJobs.get(jobId);
                if (memJob && memJob.userId === userId) {
                    job = memJob;
                }
            }

            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: 'Job not found'
                });
            }

            return res.json({
                success: true,
                data: {
                    job_id: job.id || jobId,
                    status: job.status,
                    progress: this.getJobProgress(job.status),
                    created_at: job.createdAt.toISOString(),
                    updated_at: job.updatedAt.toISOString()
                }
            });

        } catch (error) {
            console.error('Status Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get job status'
            });
        }
    }

    /**
     * Get OCR results
     */
    async getResults(req, res) {
        try {
            const { jobId } = req.params;
            const userId = req.user?.id || 'demo-user';

            // Try to get from database first
            let job = null;
            try {
                const dbJob = await IdentityDocument.findOne({ jobId: jobId, userId: userId });
                if (dbJob) {
                    job = {
                        id: dbJob.jobId,
                        status: dbJob.status,
                        extractedData: dbJob.extractedData,
                        confidenceScore: dbJob.overallConfidence,
                        error: dbJob.errorMessage,
                        processedAt: dbJob.processedAt
                    };
                }
            } catch (dbError) {
                console.warn('⚠️  Database query failed, using in-memory storage:', dbError.message);
            }

            // Fallback to in-memory storage
            if (!job) {
                const memJob = this.ocrJobs.get(jobId);
                if (memJob && memJob.userId === userId) {
                    job = memJob;
                }
            }

            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: 'Results not found'
                });
            }

            if (job.status === 'pending' || job.status === 'processing') {
                return res.status(202).json({
                    success: false,
                    error: 'OCR processing not yet completed'
                });
            }

            return res.json({
                success: true,
                data: {
                    job_id: job.id || jobId,
                    status: job.status,
                    extracted_data: job.extractedData || null,
                    confidence_score: job.confidenceScore || 0,
                    error: job.error || null,
                    processed_at: job.processedAt?.toISOString() || null
                }
            });

        } catch (error) {
            console.error('Results Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get job results'
            });
        }
    }

    /**
     * Save or update document data
     */
    async saveDocumentData(req, res) {
        try {
            const userId = req.user?.id || 'demo-user';
            const { job_id, lastName, firstName, middleInitial, addressStreet, addressCity, addressState, addressZip, sex, dob } = req.body;

            if (!job_id) {
                return res.status(422).json({
                    success: false,
                    error: 'job_id is required'
                });
            }

            // Update database record
            try {
                const updatedDoc = await IdentityDocument.findOneAndUpdate(
                    { jobId: job_id, userId: userId },
                    {
                        extractedData: {
                            lastName,
                            firstName,
                            middleInitial,
                            addressStreet,
                            addressCity,
                            addressState,
                            addressZip,
                            sex,
                            dob: dob ? new Date(dob) : null
                        },
                        updatedAt: new Date()
                    },
                    { new: true }
                );

                if (!updatedDoc) {
                    return res.status(404).json({
                        success: false,
                        error: 'Document not found'
                    });
                }

                console.log(`✅ Document data saved for job ${job_id}`);

                return res.json({
                    success: true,
                    data: {
                        job_id: updatedDoc.jobId,
                        message: 'Document data saved successfully'
                    }
                });

            } catch (dbError) {
                console.error('❌ Database update failed:', dbError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save document data'
                });
            }

        } catch (error) {
            console.error('Save Document Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to save document data'
            });
        }
    }

    /**
     * Convert HEIC file to JPEG
     */
    async convertHeicToJpeg(filePath, filename) {
        try {
            // Read HEIC file
            const heicBuffer = await fs.readFile(filePath);

            // Convert HEIC to JPEG using heic-convert
            const jpegBuffer = await heicConvert({
                buffer: heicBuffer,
                format: 'JPEG',
                quality: 0.8
            });

            // Generate new filename
            const jpegFilename = filename.replace(/\.heic$/i, '.jpg');
            const jpegPath = path.join(path.dirname(filePath), jpegFilename);

            // Save JPEG file
            await fs.writeFile(jpegPath, jpegBuffer);

            // Delete original HEIC file
            await fs.unlink(filePath);

            return jpegPath;

        } catch (error) {
            console.error('HEIC conversion error:', error);
            throw new Error('Failed to convert HEIC file to JPEG');
        }
    }

    /**
     * Get job progress based on status
     */
    getJobProgress(status) {
        switch (status) {
            case 'pending': return 0;
            case 'processing': return 50;
            case 'completed': return 100;
            case 'failed': return 0;
            default: return 0;
        }
    }
}

module.exports = IdUploadController;