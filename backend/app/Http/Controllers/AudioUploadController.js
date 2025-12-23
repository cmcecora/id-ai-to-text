const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const TranscriptionExtractJob = require('../../Jobs/TranscriptionExtractJob');
const TranscriptDocument = require('../../Models/TranscriptDocument');

/**
 * AudioUploadController
 *
 * Handles audio file uploads for transcription and field extraction.
 * Mirrors the IdUploadController pattern for consistency.
 *
 * Flow:
 * 1. Upload audio file (mp3, wav, m4a, webm)
 * 2. Transcribe using OpenAI Whisper API
 * 3. Create TranscriptDocument record
 * 4. Dispatch TranscriptionExtractJob for field extraction
 * 5. Return job_id for polling
 */
class AudioUploadController {
    constructor() {
        this.audioJobs = new Map(); // In-memory job storage for backwards compatibility
    }

    /**
     * Upload and process audio file
     */
    async upload(req, res) {
        try {
            if (!req.file) {
                return res.status(422).json({
                    success: false,
                    error: 'No audio file uploaded'
                });
            }

            const file = req.file;
            const userId = req.user?.id || 'demo-user';

            // Validate file was stored successfully
            if (!file.path) {
                return res.status(500).json({
                    success: false,
                    error: 'File storage failed'
                });
            }

            // Validate audio file type
            const allowedMimeTypes = [
                'audio/mpeg',      // mp3
                'audio/mp3',
                'audio/wav',
                'audio/x-wav',
                'audio/wave',
                'audio/x-m4a',
                'audio/m4a',
                'audio/mp4',
                'audio/webm',
                'audio/ogg'
            ];

            if (!allowedMimeTypes.includes(file.mimetype)) {
                // Clean up uploaded file
                try {
                    await fs.unlink(file.path);
                } catch (e) { /* ignore */ }

                return res.status(422).json({
                    success: false,
                    error: 'Invalid audio file type. Supported formats: MP3, WAV, M4A, WebM, OGG'
                });
            }

            // Generate job ID
            const jobId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            console.log(`📁 Audio file received: ${file.originalname} (${file.size} bytes)`);

            // Step 1: Transcribe audio using Whisper API
            let transcript;
            let audioDuration;
            try {
                console.log(`🎤 Starting Whisper transcription for job ${jobId}...`);
                const transcriptionResult = await this.transcribeWithWhisper(file.path);
                transcript = transcriptionResult.text;
                audioDuration = transcriptionResult.duration;
                console.log(`✅ Transcription complete: ${transcript.length} characters, ${audioDuration || 'unknown'} seconds`);
            } catch (transcriptionError) {
                console.error('❌ Whisper transcription failed:', transcriptionError);

                // Clean up uploaded file
                try {
                    await fs.unlink(file.path);
                } catch (e) { /* ignore */ }

                return res.status(500).json({
                    success: false,
                    error: 'Audio transcription failed. Please try again.'
                });
            }

            // Step 2: Create database record
            try {
                await TranscriptDocument.create({
                    jobId: jobId,
                    userId: userId,
                    sourceType: 'audio_upload',
                    audioFilePath: file.path,
                    originalFileName: file.originalname,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    audioDuration: audioDuration,
                    rawTranscript: transcript,
                    status: 'pending'
                });
                console.log(`✅ Created TranscriptDocument for job ${jobId}`);
            } catch (dbError) {
                console.warn('⚠️  Failed to create database record, using in-memory storage:', dbError.message);
            }

            // Store job information in memory (backwards compatibility)
            this.audioJobs.set(jobId, {
                id: jobId,
                userId: userId,
                status: 'pending',
                filePath: file.path,
                originalName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype,
                audioDuration: audioDuration,
                rawTranscript: transcript,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Step 3: Dispatch extraction job
            const extractJob = new TranscriptionExtractJob(transcript, userId, jobId, {
                sourceType: 'audio_upload',
                audioFilePath: file.path,
                saveToDb: true
            });

            extractJob.handle()
                .then(async result => {
                    // Update job status in database
                    try {
                        await TranscriptDocument.findOneAndUpdate(
                            { jobId: jobId },
                            {
                                status: 'completed',
                                extractedData: result.extractedData,
                                confidenceScores: result.confidenceScores,
                                overallConfidence: result.overallConfidence,
                                processingTime: result.processingTime,
                                processedAt: new Date()
                            }
                        );
                        console.log(`✅ Job ${jobId} completed successfully`);
                    } catch (dbError) {
                        console.warn('⚠️  Failed to update database record:', dbError.message);
                    }

                    // Update in-memory storage
                    const job = this.audioJobs.get(jobId);
                    if (job) {
                        job.status = 'completed';
                        job.extractedData = result.extractedData;
                        job.confidenceScores = result.confidenceScores;
                        job.overallConfidence = result.overallConfidence;
                        job.processedAt = new Date();
                        job.updatedAt = new Date();
                    }
                })
                .catch(async error => {
                    console.error(`❌ Job ${jobId} failed:`, error.message);

                    // Update job status in database
                    try {
                        await TranscriptDocument.findOneAndUpdate(
                            { jobId: jobId },
                            {
                                status: 'failed',
                                errorMessage: error.message
                            }
                        );
                    } catch (dbError) {
                        console.warn('⚠️  Failed to update database record:', dbError.message);
                    }

                    // Update in-memory storage
                    const job = this.audioJobs.get(jobId);
                    if (job) {
                        job.status = 'failed';
                        job.error = error.message;
                        job.updatedAt = new Date();
                    }
                });

            // Return immediately with job ID
            return res.json({
                success: true,
                data: {
                    job_id: jobId,
                    file_path: file.path,
                    original_name: file.originalname,
                    file_size: file.size,
                    mime_type: file.mimetype,
                    audio_duration: audioDuration,
                    transcript_preview: transcript.substring(0, 200) + (transcript.length > 200 ? '...' : ''),
                    message: 'Audio uploaded and transcribed. Field extraction started.'
                }
            });

        } catch (error) {
            console.error('Audio Upload Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Audio upload failed. Please try again.'
            });
        }
    }

    /**
     * Transcribe audio using OpenAI Whisper API
     */
    async transcribeWithWhisper(audioFilePath) {
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new Error('OPENAI_API_KEY not configured');
        }

        // Read the audio file
        const audioBuffer = await fs.readFile(audioFilePath);
        const filename = path.basename(audioFilePath);

        // Create form data for the API request
        const formData = new FormData();
        formData.append('file', audioBuffer, {
            filename: filename,
            contentType: this.getMimeType(audioFilePath)
        });
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');
        formData.append('response_format', 'verbose_json'); // Get duration info

        // Make request to OpenAI Whisper API
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Whisper API error:', response.status, errorText);
            throw new Error(`Whisper API error: ${response.status}`);
        }

        const result = await response.json();

        return {
            text: result.text || '',
            duration: result.duration || null,
            language: result.language || 'en'
        };
    }

    /**
     * Get MIME type from file path
     */
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.m4a': 'audio/m4a',
            '.webm': 'audio/webm',
            '.ogg': 'audio/ogg',
            '.mp4': 'audio/mp4'
        };
        return mimeTypes[ext] || 'audio/mpeg';
    }

    /**
     * Get job status
     */
    async getStatus(req, res) {
        try {
            const { jobId } = req.params;
            const userId = req.user?.id || 'demo-user';

            // Try to get from database first
            let job = null;
            try {
                const dbJob = await TranscriptDocument.findOne({ jobId: jobId, userId: userId });
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
                const memJob = this.audioJobs.get(jobId);
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
                    created_at: job.createdAt?.toISOString(),
                    updated_at: job.updatedAt?.toISOString()
                }
            });

        } catch (error) {
            console.error('Audio Status Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get job status'
            });
        }
    }

    /**
     * Get extraction results
     */
    async getResults(req, res) {
        try {
            const { jobId } = req.params;
            const userId = req.user?.id || 'demo-user';

            // Try to get from database first
            let job = null;
            try {
                const dbJob = await TranscriptDocument.findOne({ jobId: jobId, userId: userId });
                if (dbJob) {
                    job = {
                        id: dbJob.jobId,
                        status: dbJob.status,
                        rawTranscript: dbJob.rawTranscript,
                        extractedData: dbJob.extractedData,
                        confidenceScores: dbJob.confidenceScores,
                        overallConfidence: dbJob.overallConfidence,
                        audioDuration: dbJob.audioDuration,
                        error: dbJob.errorMessage,
                        processedAt: dbJob.processedAt
                    };
                }
            } catch (dbError) {
                console.warn('⚠️  Database query failed, using in-memory storage:', dbError.message);
            }

            // Fallback to in-memory storage
            if (!job) {
                const memJob = this.audioJobs.get(jobId);
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
                    error: 'Extraction not yet completed',
                    data: {
                        job_id: job.id || jobId,
                        status: job.status,
                        progress: this.getJobProgress(job.status)
                    }
                });
            }

            return res.json({
                success: true,
                data: {
                    job_id: job.id || jobId,
                    status: job.status,
                    raw_transcript: job.rawTranscript || null,
                    extracted_data: job.extractedData || null,
                    confidence: job.confidenceScores || {},
                    overall_confidence: job.overallConfidence || 0,
                    audio_duration: job.audioDuration || null,
                    error: job.error || null,
                    processed_at: job.processedAt?.toISOString() || null
                }
            });

        } catch (error) {
            console.error('Audio Results Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get job results'
            });
        }
    }

    /**
     * Get job progress based on status
     */
    getJobProgress(status) {
        switch (status) {
            case 'pending': return 25;      // Transcription done, extraction pending
            case 'processing': return 60;   // Extraction in progress
            case 'completed': return 100;
            case 'failed': return 0;
            default: return 0;
        }
    }
}

module.exports = AudioUploadController;
