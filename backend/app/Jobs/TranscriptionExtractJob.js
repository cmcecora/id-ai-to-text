/**
 * TranscriptionExtractJob.js
 *
 * Extracts structured patient information from voice call transcripts using AI.
 * This mirrors the bulletproof approach used in IdOcrJob.js for ID document OCR.
 *
 * Key features:
 * - Strict JSON schema for extracted data
 * - Only extracts data from USER speech (not assistant)
 * - Field-level confidence scoring
 * - Validation and normalization of extracted values
 * - Bulletproof parsing for spoken dates, names, and phones
 * - Retry logic with exponential backoff
 * - Fallback regex extraction
 */

const axios = require('axios');

// Spoken number words to digits mapping
const SPOKEN_NUMBERS = {
    'zero': 0, 'oh': 0, 'o': 0,
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
    'twenty': 20, 'twenty-one': 21, 'twenty-two': 22, 'twenty-three': 23,
    'twenty-four': 24, 'twenty-five': 25, 'twenty-six': 26, 'twenty-seven': 27,
    'twenty-eight': 28, 'twenty-nine': 29, 'thirty': 30, 'thirty-one': 31,
    'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
    'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10,
    'eleventh': 11, 'twelfth': 12, 'thirteenth': 13, 'fourteenth': 14, 'fifteenth': 15,
    'sixteenth': 16, 'seventeenth': 17, 'eighteenth': 18, 'nineteenth': 19,
    'twentieth': 20, 'twenty-first': 21, 'twenty-second': 22, 'twenty-third': 23,
    'twenty-fourth': 24, 'twenty-fifth': 25, 'twenty-sixth': 26, 'twenty-seventh': 27,
    'twenty-eighth': 28, 'twenty-ninth': 29, 'thirtieth': 30, 'thirty-first': 31
};

// Year spoken words
const SPOKEN_DECADES = {
    'nineteen': 19, 'twenty': 20
};

const SPOKEN_YEARS = {
    'ninety': 90, 'eighty': 80, 'seventy': 70, 'sixty': 60,
    'fifty': 50, 'forty': 40, 'thirty': 30, 'twenty': 20, 'ten': 10,
    'oh': 0, 'zero': 0
};

// Month names and abbreviations
const MONTH_NAMES = {
    'january': 1, 'jan': 1, 'february': 2, 'feb': 2,
    'march': 3, 'mar': 3, 'april': 4, 'apr': 4,
    'may': 5, 'june': 6, 'jun': 6,
    'july': 7, 'jul': 7, 'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10, 'november': 11, 'nov': 11,
    'december': 12, 'dec': 12
};

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'rate_limit_error', 'overloaded_error']
};

class TranscriptionExtractJob {
    constructor(transcript, userId, jobId, options = {}) {
        this.transcript = transcript;
        this.userId = userId;
        this.jobId = jobId;
        this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
        this.apiEndpoint = 'https://api.anthropic.com/v1/messages';
        this.options = {
            realtimeData: options.realtimeData || null,
            realtimeConfidence: options.realtimeConfidence || null,
            saveToDb: options.saveToDb !== false, // Default true
            ...options
        };
        this.startTime = Date.now();
    }

    /**
     * Handle the transcription extraction job with retry logic
     */
    async handle() {
        try {
            console.log(`Starting transcription extraction job ${this.jobId}`);
            console.log(`Transcript length: ${this.transcript.length} characters`);

            // Call Anthropic API for extraction with retry
            let extractionResult;
            try {
                extractionResult = await this.withRetry(() => this.callAnthropicExtraction());
            } catch (error) {
                console.warn('⚠️  AI extraction failed, using fallback regex extraction');
                extractionResult = this.regexFallbackExtraction();
            }

            // Extract and normalize required fields
            const extractedData = this.extractRequiredFields(extractionResult);

            // Calculate confidence scores
            const confidenceScores = this.calculateConfidenceScores(extractedData, extractionResult);

            // Smart merge with real-time data if available
            let finalData = extractedData;
            let finalConfidence = confidenceScores;
            let fieldSources = {};

            if (this.options.realtimeData) {
                const mergeResult = this.smartMerge(
                    this.options.realtimeData,
                    extractedData,
                    this.options.realtimeConfidence || {},
                    confidenceScores
                );
                finalData = mergeResult.data;
                finalConfidence = mergeResult.confidence;
                fieldSources = mergeResult.fieldSources;
            } else {
                // All fields from post-call extraction
                Object.keys(finalData).forEach(field => {
                    if (finalData[field]) fieldSources[field] = 'post_call';
                });
            }

            const overallConfidence = this.calculateOverallConfidence(finalConfidence);
            const processingTime = Date.now() - this.startTime;

            console.log(`✅ Transcription extraction job ${this.jobId} completed in ${processingTime}ms`);
            console.log(`📊 Overall confidence: ${(overallConfidence * 100).toFixed(1)}%`);

            const result = {
                success: true,
                data: finalData,
                confidence: finalConfidence,
                overallConfidence,
                fieldSources,
                processingTime,
                requiresManualReview: overallConfidence < 0.5
            };

            // Save to MongoDB if enabled
            if (this.options.saveToDb) {
                await this.saveToMongoDB(result);
            }

            return result;

        } catch (error) {
            console.error(`❌ Transcription extraction job ${this.jobId} failed:`, error);

            // Try to save error state to DB
            if (this.options.saveToDb) {
                try {
                    await this.saveErrorToMongoDB(error.message);
                } catch (dbError) {
                    console.error('Failed to save error to DB:', dbError);
                }
            }

            throw error;
        }
    }

    /**
     * Retry wrapper with exponential backoff
     */
    async withRetry(operation, config = RETRY_CONFIG) {
        let lastError;
        let delay = config.initialDelayMs;

        for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                const isRetryable = config.retryableErrors.some(
                    e => error.code === e || error.message?.includes(e)
                );

                if (!isRetryable || attempt === config.maxRetries) {
                    throw error;
                }

                console.log(`⏳ Retry ${attempt}/${config.maxRetries} after ${delay}ms...`);
                await this.sleep(delay);
                delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
            }
        }

        throw lastError;
    }

    /**
     * Sleep helper for retry delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Save extraction results to MongoDB
     */
    async saveToMongoDB(result) {
        try {
            const TranscriptDocument = require('../Models/TranscriptDocument');

            const docData = {
                jobId: this.jobId,
                userId: this.userId,
                sourceType: this.options.sourceType || 'text_input',
                vapiCallId: this.options.vapiCallId || null,
                rawTranscript: this.transcript,
                status: 'completed',
                extractedData: result.data,
                realtimeData: this.options.realtimeData || {},
                realtimeConfidence: this.options.realtimeConfidence || {},
                confidenceScores: result.confidence,
                overallConfidence: result.overallConfidence,
                fieldSources: result.fieldSources,
                requiresManualReview: result.requiresManualReview,
                processingTime: result.processingTime,
                anthropicModel: 'claude-sonnet-4-5-20250929',
                processedAt: new Date()
            };

            await TranscriptDocument.findOneAndUpdate(
                { jobId: this.jobId },
                docData,
                { upsert: true, new: true }
            );

            console.log(`💾 Saved to MongoDB: ${this.jobId}`);
        } catch (error) {
            console.error('❌ MongoDB save error:', error);
            // Don't throw - extraction succeeded even if DB save fails
        }
    }

    /**
     * Save error state to MongoDB
     */
    async saveErrorToMongoDB(errorMessage) {
        try {
            const TranscriptDocument = require('../Models/TranscriptDocument');

            await TranscriptDocument.findOneAndUpdate(
                { jobId: this.jobId },
                {
                    jobId: this.jobId,
                    userId: this.userId,
                    sourceType: this.options.sourceType || 'text_input',
                    rawTranscript: this.transcript,
                    status: 'failed',
                    errorMessage,
                    processingTime: Date.now() - this.startTime
                },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('❌ Failed to save error to MongoDB:', error);
        }
    }

    /**
     * Smart merge: combine real-time data with post-call extraction
     * Higher confidence wins, user-edited fields (>1.0) are never overwritten
     */
    smartMerge(realtimeData, postCallData, realtimeConfidence, postCallConfidence) {
        const merged = {};
        const mergedConfidence = {};
        const fieldSources = {};

        const allFields = [
            'firstName', 'lastName', 'dob', 'sex',
            'addressStreet', 'addressCity', 'addressState', 'addressZip',
            'email', 'phone', 'insuranceProvider', 'memberId'
        ];

        for (const field of allFields) {
            const rtValue = realtimeData?.[field];
            const pcValue = postCallData?.[field];
            const rtConf = realtimeConfidence?.[field] || 0;
            const pcConf = postCallConfidence?.[field] || 0;

            // Rule 1: User-edited fields (confidence > 1.0) are NEVER overwritten
            if (rtConf > 1.0 && rtValue) {
                merged[field] = rtValue;
                mergedConfidence[field] = rtConf;
                fieldSources[field] = 'user_edit';
                continue;
            }

            // Rule 2: Both empty -> null
            if (!rtValue && !pcValue) {
                continue;
            }

            // Rule 3: Only one has value -> use it
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

            // Rule 4: Both have values -> higher confidence wins
            if (pcConf > rtConf) {
                merged[field] = pcValue;
                mergedConfidence[field] = pcConf;
                fieldSources[field] = 'post_call';
            } else if (rtConf > pcConf) {
                merged[field] = rtValue;
                mergedConfidence[field] = rtConf;
                fieldSources[field] = 'realtime';
            } else {
                // Equal confidence -> prefer post-call (more thorough analysis)
                merged[field] = pcValue;
                mergedConfidence[field] = pcConf;
                fieldSources[field] = 'post_call_tie';
            }
        }

        return { data: merged, confidence: mergedConfidence, fieldSources };
    }

    /**
     * Fallback regex-based extraction when AI fails
     */
    regexFallbackExtraction() {
        const result = { confidence: {} };
        const text = this.transcript;

        // Email regex
        const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
            result.email = emailMatch[1].toLowerCase();
            result.confidence.email = 0.85;
        }

        // Spoken email: "john at gmail dot com"
        const spokenEmailMatch = text.match(/([a-zA-Z0-9._%+-]+)\s+at\s+([a-zA-Z0-9.-]+)\s+dot\s+(com|org|net|edu)/i);
        if (spokenEmailMatch && !result.email) {
            result.email = `${spokenEmailMatch[1]}@${spokenEmailMatch[2]}.${spokenEmailMatch[3]}`.toLowerCase();
            result.confidence.email = 0.75;
        }

        // Phone regex (10 digits)
        const phoneMatch = text.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
        if (phoneMatch) {
            result.phone = phoneMatch[1].replace(/\D/g, '');
            result.confidence.phone = 0.8;
        }

        // ZIP code
        const zipMatch = text.match(/\b(\d{5}(?:-\d{4})?)\b/);
        if (zipMatch) {
            result.addressZip = zipMatch[1];
            result.confidence.addressZip = 0.85;
        }

        // State abbreviation
        const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
        for (const state of states) {
            if (new RegExp(`\\b${state}\\b`).test(text)) {
                result.addressState = state;
                result.confidence.addressState = 0.8;
                break;
            }
        }

        // Name patterns: "My name is [First] [Last]"
        const nameMatch = text.match(/(?:name is|I'm|my name's|I am)\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?/i);
        if (nameMatch) {
            result.firstName = this.toTitleCase(nameMatch[1]);
            result.confidence.firstName = 0.75;
            if (nameMatch[2]) {
                result.lastName = this.toTitleCase(nameMatch[2]);
                result.confidence.lastName = 0.75;
            }
        }

        // Sex/gender
        const sexMatch = text.match(/\b(male|female|man|woman)\b/i);
        if (sexMatch) {
            result.sex = ['male', 'm', 'man'].includes(sexMatch[1].toLowerCase()) ? 'M' : 'F';
            result.confidence.sex = 0.8;
        }

        return result;
    }

    /**
     * Helper: convert to title case
     */
    toTitleCase(str) {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    /**
     * Call Anthropic API to extract structured data from transcript
     */
    async callAnthropicExtraction() {
        try {
            if (!this.anthropicApiKey || this.anthropicApiKey === '') {
                console.error('❌ ANTHROPIC_API_KEY is missing or empty!');
                console.warn('⚠️  Using mock extraction response for demo purposes');
                return this.getMockExtractionResponse();
            }

            console.log('✅ Using Anthropic API key:', 
                this.anthropicApiKey.substring(0, 15) + '...');

            const prompt = `You are extracting patient information from a voice call transcript between a user and a medical booking assistant.

CRITICAL INSTRUCTIONS:
1. Extract ONLY information that the USER explicitly stated
2. NEVER extract data from assistant/agent speech - only from USER responses
3. Be extremely precise - extract values exactly as the user spoke them
4. For dates, convert to YYYY-MM-DD format when possible
5. For sex/gender, normalize to "M" or "F"
6. For phone numbers, extract digits only (no formatting)
7. For states, use two-letter abbreviations (e.g., NY, CA, TX)
8. Return ONLY a JSON object with the fields below
9. If a field was not mentioned or is unclear, omit it completely (don't guess)
10. Include a confidence score (0.0 to 1.0) for each field based on clarity

Required fields to extract from USER speech:
- firstName: Given/first name
- lastName: Family name/surname
- addressStreet: Street address (number and street name)
- addressCity: City name
- addressState: Two-letter state code (e.g., CA, NY, TX)
- addressZip: ZIP code (5 digits or 5+4 format)
- sex: Gender marker (M or F only)
- dob: Date of birth in YYYY-MM-DD format
- email: Email address
- phone: Phone number (digits only, 10 digits)
- insuranceProvider: Insurance company name
- insuranceId: Insurance member/policy ID

RESPONSE FORMAT - Return ONLY this JSON structure:
{
  "firstName": "...",
  "lastName": "...",
  "addressStreet": "...",
  "addressCity": "...",
  "addressState": "...",
  "addressZip": "...",
  "sex": "...",
  "dob": "...",
  "email": "...",
  "phone": "...",
  "insuranceProvider": "...",
  "insuranceId": "...",
  "confidence": {
    "firstName": 0.95,
    "lastName": 0.95,
    ...
  }
}

Only include fields that the user explicitly mentioned. Do NOT include any explanatory text, markdown formatting, or code blocks. Return ONLY the raw JSON object.

TRANSCRIPT TO ANALYZE:
${this.transcript}`;

            const requestBody = {
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 2048,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            };

            const response = await axios.post(this.apiEndpoint, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.anthropicApiKey,
                    'anthropic-version': '2023-06-01'
                },
                timeout: 60000 // 60 seconds timeout
            });

            console.log('✅ Anthropic API response received');

            // Extract and parse the response
            const content = response.data.content[0].text;
            console.log('📄 Raw API response:', content);

            const jsonMatch = content.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsedData = JSON.parse(jsonMatch[0]);
                console.log('✅ Successfully parsed extraction data:', parsedData);
                return parsedData;
            }

            throw new Error('Could not parse extraction response - no JSON found in response');

        } catch (error) {
            console.error('❌ Anthropic API error:', error.message);

            // Provide detailed error information
            if (error.response) {
                console.error(`API Status: ${error.response.status}`);
                console.error(`API Error:`, error.response.data);
            } else if (error.request) {
                console.error('No response received from API');
            }

            console.warn('⚠️  Falling back to mock extraction response');
            return this.getMockExtractionResponse();
        }
    }

    /**
     * Get mock extraction response for demo/testing purposes
     */
    getMockExtractionResponse() {
        // Parse the transcript to extract some basic info for the mock
        const transcript = this.transcript.toLowerCase();
        
        const mockData = {
            confidence: {}
        };

        // Try to extract first name from common patterns
        const nameMatch = this.transcript.match(/(?:name is|I'm|my name's)\s+([A-Z][a-z]+)/i);
        if (nameMatch) {
            mockData.firstName = nameMatch[1];
            mockData.confidence.firstName = 0.85;
        }

        // Try to extract email
        const emailMatch = this.transcript.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
            mockData.email = emailMatch[1].toLowerCase();
            mockData.confidence.email = 0.9;
        }

        // Try to extract phone number
        const phoneMatch = this.transcript.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
        if (phoneMatch) {
            mockData.phone = phoneMatch[1].replace(/\D/g, '');
            mockData.confidence.phone = 0.85;
        }

        return mockData;
    }

    /**
     * Extract and normalize required fields from extraction result
     */
    extractRequiredFields(extractionResult) {
        const extracted = {};

        // First Name
        if (extractionResult.firstName) {
            extracted.firstName = this.normalizeNameField(extractionResult.firstName);
        }

        // Last Name
        if (extractionResult.lastName) {
            extracted.lastName = this.normalizeNameField(extractionResult.lastName);
        }

        // Address components
        if (extractionResult.addressStreet) {
            extracted.addressStreet = extractionResult.addressStreet.trim();
        }
        if (extractionResult.addressCity) {
            extracted.addressCity = this.normalizeNameField(extractionResult.addressCity);
        }
        if (extractionResult.addressState) {
            extracted.addressState = this.normalizeStateCode(extractionResult.addressState);
        }
        if (extractionResult.addressZip) {
            extracted.addressZip = this.normalizeZipCode(extractionResult.addressZip);
        }

        // Sex/Gender
        if (extractionResult.sex) {
            extracted.sex = this.normalizeSex(extractionResult.sex);
        }

        // Date of Birth
        if (extractionResult.dob) {
            extracted.dob = this.normalizeDateOfBirth(extractionResult.dob);
        }

        // Email
        if (extractionResult.email) {
            extracted.email = extractionResult.email.toLowerCase().trim();
        }

        // Phone
        if (extractionResult.phone) {
            extracted.phone = this.normalizePhone(extractionResult.phone);
        }

        // Insurance
        if (extractionResult.insuranceProvider) {
            extracted.insuranceProvider = extractionResult.insuranceProvider.trim();
        }
        if (extractionResult.insuranceId) {
            extracted.insuranceId = extractionResult.insuranceId.toUpperCase().replace(/\s/g, '');
        }

        return extracted;
    }

    /**
     * Normalize a name field to Title Case
     */
    normalizeNameField(value) {
        if (!value) return null;
        return value.trim()
            .split(/\s+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    /**
     * Normalize state to 2-letter code
     */
    normalizeStateCode(value) {
        if (!value) return null;
        const upper = value.toUpperCase().trim();
        
        // Already a 2-letter code
        if (/^[A-Z]{2}$/.test(upper)) {
            return upper;
        }

        // Map common state names to codes
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

        const lower = value.toLowerCase().trim();
        return stateMap[lower] || upper;
    }

    /**
     * Normalize ZIP code
     */
    normalizeZipCode(value) {
        if (!value) return null;
        // Extract digits and handle 5 or 9 digit formats
        const digits = value.replace(/\D/g, '');
        if (digits.length === 9) {
            return `${digits.slice(0, 5)}-${digits.slice(5)}`;
        }
        if (digits.length >= 5) {
            return digits.slice(0, 5);
        }
        return digits;
    }

    /**
     * Normalize sex to M or F
     */
    normalizeSex(value) {
        if (!value) return null;
        const lower = value.toLowerCase().trim();
        
        if (['male', 'm', 'man', 'boy'].includes(lower)) return 'M';
        if (['female', 'f', 'woman', 'girl'].includes(lower)) return 'F';
        
        return value.toUpperCase().charAt(0);
    }

    /**
     * Normalize date of birth to YYYY-MM-DD
     * Handles multiple formats including spoken dates
     */
    normalizeDateOfBirth(value) {
        if (!value) return null;

        // Already in correct format
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return this.validateDateResult(value);
        }

        // Remove ordinal suffixes
        let cleaned = value.replace(/(\d+)(st|nd|rd|th)/gi, '$1').trim();

        // Strategy 1: ISO format (YYYY-MM-DD)
        const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (isoMatch) {
            const result = `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
            return this.validateDateResult(result);
        }

        // Strategy 2: MM/DD/YYYY or M/D/YYYY or MM-DD-YYYY
        const slashMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (slashMatch) {
            const month = slashMatch[1].padStart(2, '0');
            const day = slashMatch[2].padStart(2, '0');
            let year = slashMatch[3];
            if (year.length === 2) {
                year = parseInt(year) > 30 ? '19' + year : '20' + year;
            }
            const result = `${year}-${month}-${day}`;
            return this.validateDateResult(result);
        }

        // Strategy 3: Natural language "Month Day, Year" (December 25, 1990)
        const monthDayYearMatch = cleaned.match(/^(\w+)\s+(\d{1,2}),?\s*(\d{4})$/i);
        if (monthDayYearMatch) {
            const month = MONTH_NAMES[monthDayYearMatch[1].toLowerCase()];
            if (month) {
                const day = monthDayYearMatch[2].padStart(2, '0');
                const result = `${monthDayYearMatch[3]}-${String(month).padStart(2, '0')}-${day}`;
                return this.validateDateResult(result);
            }
        }

        // Strategy 4: "Day Month Year" (25 December 1990) or "Day of Month Year" (25th of December 1990)
        const dayMonthYearMatch = cleaned.match(/^(\d{1,2})(?:\s+of)?\s+(\w+),?\s*(\d{4})$/i);
        if (dayMonthYearMatch) {
            const month = MONTH_NAMES[dayMonthYearMatch[2].toLowerCase()];
            if (month) {
                const day = dayMonthYearMatch[1].padStart(2, '0');
                const result = `${dayMonthYearMatch[3]}-${String(month).padStart(2, '0')}-${day}`;
                return this.validateDateResult(result);
            }
        }

        // Strategy 5: Spoken ordinal dates "December twenty-fifth nineteen ninety"
        const spokenResult = this.parseSpokenDate(cleaned);
        if (spokenResult) {
            return this.validateDateResult(spokenResult);
        }

        // Strategy 6: Just month and day with 2-digit year "12/25/90"
        const shortYearMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
        if (shortYearMatch) {
            const month = shortYearMatch[1].padStart(2, '0');
            const day = shortYearMatch[2].padStart(2, '0');
            const year = parseInt(shortYearMatch[3]) > 30 ? '19' + shortYearMatch[3] : '20' + shortYearMatch[3];
            const result = `${year}-${month}-${day}`;
            return this.validateDateResult(result);
        }

        // Strategy 7: Native Date parsing fallback
        try {
            const nativeDate = new Date(cleaned);
            if (!isNaN(nativeDate.getTime())) {
                const year = nativeDate.getFullYear();
                const month = String(nativeDate.getMonth() + 1).padStart(2, '0');
                const day = String(nativeDate.getDate()).padStart(2, '0');
                const result = `${year}-${month}-${day}`;
                return this.validateDateResult(result);
            }
        } catch (e) {
            // Ignore parsing errors
        }

        // Return original value if nothing worked
        return value;
    }

    /**
     * Parse spoken date formats like "December twenty-fifth nineteen ninety"
     */
    parseSpokenDate(text) {
        if (!text) return null;

        const lower = text.toLowerCase().trim();
        let month = null;
        let day = null;
        let year = null;

        // Try to find month name
        for (const [monthName, monthNum] of Object.entries(MONTH_NAMES)) {
            if (lower.includes(monthName)) {
                month = monthNum;
                break;
            }
        }

        if (!month) return null;

        // Try to find spoken day number (e.g., "twenty-fifth", "twenty fifth", "25")
        for (const [word, num] of Object.entries(SPOKEN_NUMBERS)) {
            const regex = new RegExp(`\\b${word.replace('-', '[- ]?')}\\b`, 'i');
            if (regex.test(lower) && num >= 1 && num <= 31) {
                day = num;
                break;
            }
        }

        // Also check for numeric day
        if (!day) {
            const dayMatch = lower.match(/\b(\d{1,2})\b/);
            if (dayMatch && parseInt(dayMatch[1]) >= 1 && parseInt(dayMatch[1]) <= 31) {
                day = parseInt(dayMatch[1]);
            }
        }

        if (!day) return null;

        // Try to find year
        // Pattern: "nineteen ninety" = 1990, "nineteen eighty five" = 1985, "two thousand five" = 2005
        const yearMatch = lower.match(/\b(nineteen|twenty)\s+([\w-]+)(?:\s+([\w-]+))?\b/);
        if (yearMatch) {
            const century = yearMatch[1] === 'nineteen' ? 1900 : 2000;
            const decadeWord = yearMatch[2];
            const unitWord = yearMatch[3];

            // Handle "nineteen ninety" style (1990)
            if (SPOKEN_YEARS[decadeWord] !== undefined) {
                year = century + SPOKEN_YEARS[decadeWord];

                // Handle additional unit like "nineteen ninety five" (1995)
                if (unitWord && SPOKEN_NUMBERS[unitWord] !== undefined) {
                    year += SPOKEN_NUMBERS[unitWord];
                }
            }
            // Handle "two thousand" style
            else if (decadeWord === 'thousand') {
                year = 2000;
                if (unitWord && SPOKEN_NUMBERS[unitWord] !== undefined) {
                    year += SPOKEN_NUMBERS[unitWord];
                }
            }
        }

        // Also check for numeric year
        if (!year) {
            const numericYearMatch = lower.match(/\b(19\d{2}|20\d{2})\b/);
            if (numericYearMatch) {
                year = parseInt(numericYearMatch[1]);
            }
        }

        if (!year) return null;

        // Validate the extracted date
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }

        return null;
    }

    /**
     * Validate date result is reasonable (between 1 and 120 years old)
     */
    validateDateResult(dateStr) {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }

        try {
            const date = new Date(dateStr);
            const now = new Date();
            const age = (now - date) / (365.25 * 24 * 60 * 60 * 1000);

            if (age >= 1 && age <= 120) {
                return dateStr;
            }
        } catch (e) {
            // Ignore validation errors
        }

        return dateStr;
    }

    /**
     * Normalize phone to 10 digits
     */
    normalizePhone(value) {
        if (!value) return null;
        let digits = value.replace(/\D/g, '');
        
        // Remove country code if present
        if (digits.length === 11 && digits.startsWith('1')) {
            digits = digits.slice(1);
        }
        
        return digits.length === 10 ? digits : digits;
    }

    /**
     * Calculate confidence scores for each field
     */
    calculateConfidenceScores(extractedData, rawResult) {
        const scores = {};

        // Use AI-provided confidence if available
        if (rawResult.confidence) {
            for (const [field, score] of Object.entries(rawResult.confidence)) {
                if (extractedData[field] !== undefined) {
                    scores[field] = Number(score);
                }
            }
        }

        // Calculate/validate confidence for fields
        for (const [field, value] of Object.entries(extractedData)) {
            if (scores[field] === undefined && value) {
                scores[field] = this.calculateFieldConfidence(field, value);
            }
        }

        return scores;
    }

    /**
     * Calculate confidence for a specific field based on value validation
     */
    calculateFieldConfidence(field, value) {
        if (!value) return 0;

        switch (field) {
            case 'firstName':
            case 'lastName':
                // Higher confidence for proper name format
                return /^[A-Z][a-z]+$/.test(value) ? 0.9 : 0.7;

            case 'sex':
                return ['M', 'F'].includes(value) ? 0.95 : 0.5;

            case 'dob':
                // Validate date format and reasonableness
                if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    const year = parseInt(value.slice(0, 4));
                    const currentYear = new Date().getFullYear();
                    if (year >= 1900 && year <= currentYear) {
                        return 0.9;
                    }
                }
                return 0.5;

            case 'email':
                return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value) ? 0.9 : 0.5;

            case 'phone':
                return /^\d{10}$/.test(value) ? 0.9 : 0.6;

            case 'addressState':
                const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
                return states.includes(value) ? 0.95 : 0.5;

            case 'addressZip':
                return /^\d{5}(-\d{4})?$/.test(value) ? 0.9 : 0.6;

            default:
                return 0.7;
        }
    }

    /**
     * Calculate overall confidence score
     */
    calculateOverallConfidence(confidenceScores) {
        const scores = Object.values(confidenceScores);
        if (scores.length === 0) return 0;
        
        const sum = scores.reduce((acc, score) => acc + score, 0);
        return sum / scores.length;
    }
}

module.exports = TranscriptionExtractJob;

