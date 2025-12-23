/**
 * TranscriptionController.js
 *
 * Handles API endpoints for extracting structured data from voice transcriptions.
 * This mirrors the approach used in IdUploadController but for text/transcript extraction.
 *
 * Endpoints:
 * - POST /api/transcription/extract - Quick synchronous extraction
 * - POST /api/transcription/process - Full async processing with MongoDB persistence
 * - GET /api/transcription/:jobId/status - Poll job status
 * - GET /api/transcription/:jobId - Get extraction results
 * - POST /api/transcription/merge - Merge real-time + post-call data
 * - POST /api/transcription/validate - Validate extracted data
 * - POST /api/transcription/parse-address - Parse address string
 */

const TranscriptionExtractJob = require('../../Jobs/TranscriptionExtractJob');

class TranscriptionController {
    constructor() {
        // In-memory job storage for backwards compatibility
        this.extractionJobs = new Map();
    }

    /**
     * Process full transcript with MongoDB persistence (async job pattern)
     * POST /api/transcription/process
     *
     * Request body:
     * {
     *   "transcript": "Full transcript text...",
     *   "vapiCallId": "optional-call-id",
     *   "realtimeData": { data collected during call },
     *   "realtimeConfidence": { confidence scores from real-time },
     *   "sourceType": "vapi_call" | "audio_upload" | "text_input"
     * }
     */
    async processFullTranscript(req, res) {
        try {
            const {
                transcript,
                vapiCallId,
                realtimeData,
                realtimeConfidence,
                sourceType = 'text_input'
            } = req.body;
            const userId = req.user?.id || 'demo-user';

            // Validate transcript
            if (!transcript || typeof transcript !== 'string') {
                return res.status(422).json({
                    success: false,
                    error: 'Transcript is required and must be a string'
                });
            }

            if (transcript.trim().length < 10) {
                return res.status(422).json({
                    success: false,
                    error: 'Transcript is too short to extract meaningful data'
                });
            }

            console.log(`📝 Processing full transcript for user ${userId}`);
            console.log(`📝 Transcript length: ${transcript.length} characters`);
            console.log(`📝 Source type: ${sourceType}`);

            // Generate job ID
            const jobId = `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Store initial job state
            this.extractionJobs.set(jobId, {
                status: 'processing',
                progress: 50,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Create extraction job with options
            const extractJob = new TranscriptionExtractJob(transcript, userId, jobId, {
                realtimeData: realtimeData || null,
                realtimeConfidence: realtimeConfidence || null,
                sourceType,
                vapiCallId: vapiCallId || null,
                saveToDb: true
            });

            // Run extraction (can be made async with queue in production)
            try {
                const result = await extractJob.handle();

                // Update job state
                this.extractionJobs.set(jobId, {
                    status: 'completed',
                    progress: 100,
                    result,
                    createdAt: this.extractionJobs.get(jobId)?.createdAt || new Date(),
                    updatedAt: new Date()
                });

                console.log(`✅ Full transcript processing completed: ${jobId}`);

                return res.json({
                    success: true,
                    data: {
                        job_id: jobId,
                        status: 'completed',
                        extracted_data: result.data,
                        confidence: result.confidence,
                        overall_confidence: result.overallConfidence,
                        field_sources: result.fieldSources,
                        requires_manual_review: result.requiresManualReview,
                        processing_time: result.processingTime
                    }
                });

            } catch (jobError) {
                console.error(`❌ Extraction job failed: ${jobId}`, jobError);

                // Update job state to failed
                this.extractionJobs.set(jobId, {
                    status: 'failed',
                    progress: 0,
                    error: jobError.message,
                    createdAt: this.extractionJobs.get(jobId)?.createdAt || new Date(),
                    updatedAt: new Date()
                });

                return res.status(500).json({
                    success: false,
                    data: {
                        job_id: jobId,
                        status: 'failed',
                        error: jobError.message
                    }
                });
            }

        } catch (error) {
            console.error('❌ Process transcript error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to process transcript'
            });
        }
    }

    /**
     * Get job status
     * GET /api/transcription/:jobId/status
     */
    async getStatus(req, res) {
        try {
            const { jobId } = req.params;

            if (!jobId) {
                return res.status(422).json({
                    success: false,
                    error: 'Job ID is required'
                });
            }

            // Try MongoDB first
            try {
                const TranscriptDocument = require('../../Models/TranscriptDocument');
                const doc = await TranscriptDocument.findByJobId(jobId);

                if (doc) {
                    return res.json({
                        success: true,
                        data: {
                            job_id: jobId,
                            status: doc.status,
                            progress: doc.status === 'completed' ? 100 :
                                      doc.status === 'processing' ? 50 :
                                      doc.status === 'failed' ? 0 : 0,
                            created_at: doc.createdAt,
                            updated_at: doc.updatedAt,
                            requires_manual_review: doc.requiresManualReview
                        }
                    });
                }
            } catch (dbError) {
                console.warn('MongoDB lookup failed, using in-memory:', dbError.message);
            }

            // Fallback to in-memory storage
            const job = this.extractionJobs.get(jobId);

            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: 'Job not found'
                });
            }

            return res.json({
                success: true,
                data: {
                    job_id: jobId,
                    status: job.status,
                    progress: job.progress,
                    created_at: job.createdAt,
                    updated_at: job.updatedAt
                }
            });

        } catch (error) {
            console.error('❌ Get status error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get job status'
            });
        }
    }

    /**
     * Get extraction results
     * GET /api/transcription/:jobId
     */
    async getResults(req, res) {
        try {
            const { jobId } = req.params;

            if (!jobId) {
                return res.status(422).json({
                    success: false,
                    error: 'Job ID is required'
                });
            }

            // Try MongoDB first
            try {
                const TranscriptDocument = require('../../Models/TranscriptDocument');
                const doc = await TranscriptDocument.findByJobId(jobId);

                if (doc) {
                    if (doc.status === 'completed') {
                        return res.json({
                            success: true,
                            data: {
                                job_id: jobId,
                                status: 'completed',
                                extracted_data: doc.extractedData,
                                confidence: doc.confidenceScores,
                                overall_confidence: doc.overallConfidence,
                                field_sources: doc.fieldSources,
                                requires_manual_review: doc.requiresManualReview,
                                processing_time: doc.processingTime,
                                processed_at: doc.processedAt
                            }
                        });
                    } else if (doc.status === 'failed') {
                        return res.json({
                            success: false,
                            data: {
                                job_id: jobId,
                                status: 'failed',
                                error: doc.errorMessage
                            }
                        });
                    } else {
                        return res.status(202).json({
                            success: true,
                            data: {
                                job_id: jobId,
                                status: doc.status,
                                message: 'Extraction still in progress'
                            }
                        });
                    }
                }
            } catch (dbError) {
                console.warn('MongoDB lookup failed, using in-memory:', dbError.message);
            }

            // Fallback to in-memory storage
            const job = this.extractionJobs.get(jobId);

            if (!job) {
                return res.status(404).json({
                    success: false,
                    error: 'Job not found'
                });
            }

            if (job.status === 'completed' && job.result) {
                return res.json({
                    success: true,
                    data: {
                        job_id: jobId,
                        status: 'completed',
                        extracted_data: job.result.data,
                        confidence: job.result.confidence,
                        overall_confidence: job.result.overallConfidence,
                        field_sources: job.result.fieldSources,
                        requires_manual_review: job.result.requiresManualReview,
                        processing_time: job.result.processingTime
                    }
                });
            } else if (job.status === 'failed') {
                return res.json({
                    success: false,
                    data: {
                        job_id: jobId,
                        status: 'failed',
                        error: job.error
                    }
                });
            } else {
                return res.status(202).json({
                    success: true,
                    data: {
                        job_id: jobId,
                        status: job.status,
                        message: 'Extraction still in progress'
                    }
                });
            }

        } catch (error) {
            console.error('❌ Get results error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get results'
            });
        }
    }

    /**
     * Merge real-time data with post-call extraction results
     * POST /api/transcription/merge
     *
     * Request body:
     * {
     *   "realtimeData": { field values from real-time collection },
     *   "realtimeConfidence": { field confidence scores },
     *   "postCallData": { field values from post-call extraction },
     *   "postCallConfidence": { field confidence scores }
     * }
     */
    async mergeData(req, res) {
        try {
            const {
                realtimeData,
                realtimeConfidence,
                postCallData,
                postCallConfidence
            } = req.body;

            if (!realtimeData && !postCallData) {
                return res.status(422).json({
                    success: false,
                    error: 'At least one of realtimeData or postCallData is required'
                });
            }

            const allFields = [
                'firstName', 'lastName', 'dob', 'sex',
                'addressStreet', 'addressCity', 'addressState', 'addressZip',
                'email', 'phone', 'insuranceProvider', 'memberId'
            ];

            const merged = {};
            const mergedConfidence = {};
            const fieldSources = {};

            for (const field of allFields) {
                const rtValue = realtimeData?.[field];
                const pcValue = postCallData?.[field];
                const rtConf = realtimeConfidence?.[field] || 0;
                const pcConf = postCallConfidence?.[field] || 0;

                // User-edited fields (confidence > 1.0) are NEVER overwritten
                if (rtConf > 1.0 && rtValue) {
                    merged[field] = rtValue;
                    mergedConfidence[field] = rtConf;
                    fieldSources[field] = 'user_edit';
                    continue;
                }

                // Both empty -> skip
                if (!rtValue && !pcValue) continue;

                // Only one has value -> use it
                if (rtValue && !pcValue) {
                    merged[field] = rtValue;
                    mergedConfidence[field] = rtConf || 0.7;
                    fieldSources[field] = 'realtime';
                    continue;
                }
                if (pcValue && !rtValue) {
                    merged[field] = pcValue;
                    mergedConfidence[field] = pcConf || 0.7;
                    fieldSources[field] = 'post_call';
                    continue;
                }

                // Both have values -> higher confidence wins
                if (pcConf > rtConf) {
                    merged[field] = pcValue;
                    mergedConfidence[field] = pcConf;
                    fieldSources[field] = 'post_call';
                } else if (rtConf > pcConf) {
                    merged[field] = rtValue;
                    mergedConfidence[field] = rtConf;
                    fieldSources[field] = 'realtime';
                } else {
                    // Equal confidence -> prefer post-call
                    merged[field] = pcValue;
                    mergedConfidence[field] = pcConf;
                    fieldSources[field] = 'post_call_tie';
                }
            }

            // Calculate overall confidence
            const scores = Object.values(mergedConfidence).filter(s => s <= 1.0);
            const overallConfidence = scores.length > 0
                ? scores.reduce((a, b) => a + b, 0) / scores.length
                : 0;

            return res.json({
                success: true,
                data: {
                    merged_data: merged,
                    confidence: mergedConfidence,
                    overall_confidence: overallConfidence,
                    field_sources: fieldSources
                }
            });

        } catch (error) {
            console.error('❌ Merge data error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to merge data'
            });
        }
    }

    /**
     * Extract structured data from a voice call transcript
     * POST /api/transcription/extract
     * 
     * Request body:
     * {
     *   "transcript": "Full transcript of the voice call...",
     *   "existingData": { ... optional existing data to merge with ... }
     * }
     * 
     * Response:
     * {
     *   "success": true,
     *   "data": {
     *     "extracted_data": { ... },
     *     "confidence": { ... },
     *     "overall_confidence": 0.85
     *   }
     * }
     */
    async extract(req, res) {
        try {
            const { transcript, existingData } = req.body;
            const userId = req.user?.id || 'demo-user';

            // Validate transcript
            if (!transcript || typeof transcript !== 'string') {
                return res.status(422).json({
                    success: false,
                    error: 'Transcript is required and must be a string'
                });
            }

            if (transcript.trim().length < 10) {
                return res.status(422).json({
                    success: false,
                    error: 'Transcript is too short to extract meaningful data'
                });
            }

            console.log(`📝 Processing transcript extraction for user ${userId}`);
            console.log(`📝 Transcript length: ${transcript.length} characters`);

            // Generate job ID
            const jobId = `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create and run the extraction job
            const extractJob = new TranscriptionExtractJob(transcript, userId, jobId);
            const result = await extractJob.handle();

            // Merge with existing data if provided
            let mergedData = result.data;
            let mergedConfidence = result.confidence;

            if (existingData && typeof existingData === 'object') {
                const mergeResult = this.smartMerge(existingData, result.data, result.confidence);
                mergedData = mergeResult.data;
                mergedConfidence = mergeResult.confidence;
            }

            console.log(`✅ Transcript extraction completed for job ${jobId}`);

            return res.json({
                success: true,
                data: {
                    job_id: jobId,
                    extracted_data: mergedData,
                    confidence: mergedConfidence,
                    overall_confidence: result.overallConfidence
                }
            });

        } catch (error) {
            console.error('❌ Transcript extraction error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to extract data from transcript'
            });
        }
    }

    /**
     * Smart merge: combine existing data with newly extracted data
     * Uses confidence scores to determine which value to keep
     * 
     * Rules:
     * 1. Highest confidence wins
     * 2. Non-empty wins over empty
     * 3. Existing user-edited values are preserved (marked with confidence > 1.0)
     */
    smartMerge(existingData, newData, newConfidence, existingConfidence = {}) {
        const mergedData = { ...existingData };
        const mergedConfidence = { ...existingConfidence };

        for (const [field, newValue] of Object.entries(newData)) {
            if (newValue === undefined || newValue === null || newValue === '') {
                continue;
            }

            const existingValue = existingData[field];
            const existingConf = existingConfidence[field] || 0;
            const newConf = newConfidence[field] || 0.7;

            // Check if existing value is user-edited (confidence > 1.0 indicates user edit)
            if (existingConf > 1.0) {
                console.log(`🔒 Keeping user-edited value for ${field}: "${existingValue}"`);
                continue;
            }

            // Empty existing value - use new value
            if (!existingValue || existingValue === '') {
                mergedData[field] = newValue;
                mergedConfidence[field] = newConf;
                console.log(`📥 Using new value for ${field}: "${newValue}" (confidence: ${newConf.toFixed(2)})`);
                continue;
            }

            // Compare confidence scores
            if (newConf > existingConf) {
                mergedData[field] = newValue;
                mergedConfidence[field] = newConf;
                console.log(`⬆️ Upgrading ${field}: "${existingValue}" -> "${newValue}" (confidence: ${existingConf.toFixed(2)} -> ${newConf.toFixed(2)})`);
            } else {
                console.log(`⬇️ Keeping existing value for ${field}: "${existingValue}" (confidence: ${existingConf.toFixed(2)} >= ${newConf.toFixed(2)})`);
            }
        }

        return {
            data: mergedData,
            confidence: mergedConfidence
        };
    }

    /**
     * Validate extracted data against expected patterns
     * POST /api/transcription/validate
     * 
     * Request body:
     * {
     *   "data": { extracted form data }
     * }
     * 
     * Response:
     * {
     *   "success": true,
     *   "data": {
     *     "valid": true/false,
     *     "errors": { field: "error message" },
     *     "warnings": { field: "warning message" }
     *   }
     * }
     */
    async validate(req, res) {
        try {
            const { data } = req.body;

            if (!data || typeof data !== 'object') {
                return res.status(422).json({
                    success: false,
                    error: 'Data object is required'
                });
            }

            const errors = {};
            const warnings = {};

            // Validate firstName
            if (data.firstName) {
                if (!/^[A-Za-z\s'-]+$/.test(data.firstName)) {
                    errors.firstName = 'First name contains invalid characters';
                } else if (data.firstName.length < 2) {
                    errors.firstName = 'First name is too short';
                }
            } else {
                warnings.firstName = 'First name is missing';
            }

            // Validate lastName
            if (data.lastName) {
                if (!/^[A-Za-z\s'-]+$/.test(data.lastName)) {
                    errors.lastName = 'Last name contains invalid characters';
                } else if (data.lastName.length < 2) {
                    errors.lastName = 'Last name is too short';
                }
            } else {
                warnings.lastName = 'Last name is missing';
            }

            // Validate dob
            if (data.dob) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dob)) {
                    errors.dob = 'Date of birth must be in YYYY-MM-DD format';
                } else {
                    const dob = new Date(data.dob);
                    const today = new Date();
                    const age = Math.floor((today - dob) / (365.25 * 24 * 60 * 60 * 1000));
                    if (age < 1 || age > 120) {
                        errors.dob = 'Date of birth appears invalid';
                    }
                }
            } else {
                warnings.dob = 'Date of birth is missing';
            }

            // Validate sex
            if (data.sex) {
                if (!['M', 'F'].includes(data.sex)) {
                    errors.sex = 'Sex must be M or F';
                }
            } else {
                warnings.sex = 'Sex is missing';
            }

            // Validate email
            if (data.email) {
                if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(data.email)) {
                    errors.email = 'Invalid email format';
                }
            }

            // Validate phone
            if (data.phone) {
                const digits = data.phone.replace(/\D/g, '');
                if (digits.length !== 10) {
                    errors.phone = 'Phone number must be 10 digits';
                }
            }

            // Validate state
            if (data.addressState) {
                const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
                if (!states.includes(data.addressState)) {
                    errors.addressState = 'Invalid state code';
                }
            }

            // Validate ZIP
            if (data.addressZip) {
                if (!/^\d{5}(-\d{4})?$/.test(data.addressZip)) {
                    errors.addressZip = 'Invalid ZIP code format';
                }
            }

            const isValid = Object.keys(errors).length === 0;

            return res.json({
                success: true,
                data: {
                    valid: isValid,
                    errors,
                    warnings
                }
            });

        } catch (error) {
            console.error('❌ Validation error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to validate data'
            });
        }
    }

    /**
     * Parse an address string into components
     * POST /api/transcription/parse-address
     * 
     * Request body:
     * {
     *   "address": "123 Main St, New York, NY 10001"
     * }
     */
    async parseAddress(req, res) {
        try {
            const { address } = req.body;

            if (!address || typeof address !== 'string') {
                return res.status(422).json({
                    success: false,
                    error: 'Address string is required'
                });
            }

            const parsed = this.parseAddressString(address);

            return res.json({
                success: true,
                data: parsed
            });

        } catch (error) {
            console.error('❌ Address parsing error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to parse address'
            });
        }
    }

    /**
     * Parse an address string into components
     */
    parseAddressString(address) {
        const result = {
            street: null,
            city: null,
            state: null,
            zip: null,
            confidence: 0.5
        };

        if (!address) return result;

        let working = address.trim();

        // Extract ZIP code
        const zipMatch = working.match(/\b(\d{5}(?:-\d{4})?)\b/);
        if (zipMatch) {
            result.zip = zipMatch[1];
            working = working.replace(zipMatch[0], '').trim();
            result.confidence += 0.15;
        }

        // US States
        const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

        // Extract state (2-letter abbreviation)
        for (const state of states) {
            const stateRegex = new RegExp(`\\b${state}\\b`, 'i');
            if (stateRegex.test(working)) {
                result.state = state;
                working = working.replace(stateRegex, '').trim();
                result.confidence += 0.15;
                break;
            }
        }

        // Try full state names if no abbreviation found
        if (!result.state) {
            const stateMap = {
                'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
                'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
                'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
                'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
                'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
                'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
                'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
                'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
                'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
                'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
                'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
                'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
                'wisconsin': 'WI', 'wyoming': 'WY'
            };

            for (const [name, abbr] of Object.entries(stateMap)) {
                const stateRegex = new RegExp(`\\b${name}\\b`, 'i');
                if (stateRegex.test(working)) {
                    result.state = abbr;
                    working = working.replace(stateRegex, '').trim();
                    result.confidence += 0.1;
                    break;
                }
            }
        }

        // Clean up remaining commas and split
        working = working.replace(/,+/g, ',').replace(/^,|,$/g, '').trim();
        const parts = working.split(',').map(p => p.trim()).filter(Boolean);

        if (parts.length >= 2) {
            result.street = parts[0];
            result.city = parts[1];
            result.confidence += 0.2;
        } else if (parts.length === 1) {
            // Check if it looks like a street address
            if (/^\d+\s+/.test(parts[0])) {
                result.street = parts[0];
            } else {
                result.city = parts[0];
            }
        }

        return result;
    }
}

module.exports = TranscriptionController;

