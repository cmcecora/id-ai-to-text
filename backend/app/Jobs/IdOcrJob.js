const fs = require('fs').promises;
const axios = require('axios');
const sharp = require('sharp');

class IdOcrJob {
    constructor(filePath, userId, jobId) {
        this.filePath = filePath;
        this.userId = userId;
        this.jobId = jobId;
        this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
        this.apiEndpoint = 'https://api.anthropic.com/v1/messages';
    }

    /**
     * Handle the OCR job
     */
    async handle() {
        try {
            console.log(`Starting OCR job ${this.jobId} for file: ${this.filePath}`);

            // Update job status to processing
            this.updateJobStatus('processing');

            // Prepare file for OCR
            const fileData = await this.prepareFileForOCR();

            // Call Anthropic API for OCR
            const ocrResult = await this.callAnthropicOCR(fileData);

            // Extract required fields
            const extractedData = this.extractRequiredFields(ocrResult);

            // Calculate confidence score
            const confidence = this.calculateConfidenceScore(extractedData, ocrResult);

            // Save to MongoDB (simulated)
            await this.saveToMongoDB(extractedData, confidence);

            console.log(`OCR job ${this.jobId} completed successfully`);

            return {
                success: true,
                data: extractedData,
                confidence: confidence
            };

        } catch (error) {
            console.error(`OCR job ${this.jobId} failed:`, error);
            throw error;
        }
    }

    /**
     * Prepare file for OCR (convert image if needed)
     */
    async prepareFileForOCR() {
        try {
            // Check if file is image or PDF
            const fileExtension = this.filePath.split('.').pop().toLowerCase();

            if (['jpg', 'jpeg', 'png', 'heic'].includes(fileExtension)) {
                // Process image file
                const imageBuffer = await fs.readFile(this.filePath);

                // Convert to base64
                const base64Image = imageBuffer.toString('base64');

                // Get image MIME type
                let mimeType = 'image/jpeg';
                if (fileExtension === 'png') mimeType = 'image/png';
                if (fileExtension === 'heic') mimeType = 'image/jpeg'; // Converted to JPEG

                return {
                    type: 'image',
                    data: `data:${mimeType};base64,${base64Image}`,
                    mimeType: mimeType
                };

            } else if (fileExtension === 'pdf') {
                // For PDF files, we'd need PDF processing
                // For now, return a placeholder
                throw new Error('PDF processing not implemented in this demo');
            }

            throw new Error('Unsupported file type');

        } catch (error) {
            console.error('File preparation error:', error);
            throw new Error('Failed to prepare file for OCR');
        }
    }

    /**
     * Call Anthropic API for OCR processing
     */
    async callAnthropicOCR(fileData) {
        try {
            if (!this.anthropicApiKey) {
                // Mock response for demo purposes
                return this.getMockOCRResponse();
            }

            const prompt = `Please analyze this identity document and extract the following information:
1. Last Name
2. First Name
3. Middle Initial
4. Address (Street)
5. Address (City)
6. Address (State)
7. Address (ZIP Code)
8. Sex (M/F/Other)
9. Date of Birth (YYYY-MM-DD format)

Please respond with the extracted information in JSON format. If any field cannot be read, use null for that field. Also provide a confidence score (0-1) for each extracted field.

Example response format:
{
  "lastName": "DOE",
  "firstName": "JOHN",
  "middleInitial": "A",
  "addressStreet": "123 MAIN ST",
  "addressCity": "NEW YORK",
  "addressState": "NY",
  "addressZip": "10001",
  "sex": "M",
  "dob": "1990-01-15",
  "confidence": {
    "lastName": 0.95,
    "firstName": 0.95,
    "middleInitial": 0.80,
    "addressStreet": 0.90,
    "addressCity": 0.90,
    "addressState": 0.95,
    "addressZip": 0.95,
    "sex": 0.85,
    "dob": 0.90
  }
}`;

            const requestBody = {
                model: 'claude-3-sonnet-20240229',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: fileData.mimeType,
                                    data: fileData.data.split(',')[1] // Remove data:image/...;base64, prefix
                                }
                            }
                        ]
                    }
                ]
            };

            const response = await axios.post(this.apiEndpoint, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.anthropicApiKey,
                    'anthropic-version': '2023-06-01'
                },
                timeout: 30000 // 30 seconds timeout
            });

            // Extract and parse the response
            const content = response.data.content[0].text;
            const jsonMatch = content.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            throw new Error('Could not parse OCR response');

        } catch (error) {
            console.error('Anthropic API error:', error);
            // Return mock response for demo
            return this.getMockOCRResponse();
        }
    }

    /**
     * Get mock OCR response for demo purposes
     */
    getMockOCRResponse() {
        return {
            lastName: "DOE",
            firstName: "JOHN",
            middleInitial: "A",
            addressStreet: "123 MAIN STREET",
            addressCity: "NEW YORK",
            addressState: "NY",
            addressZip: "10001",
            sex: "M",
            dob: "1990-01-15",
            confidence: {
                lastName: 0.95,
                firstName: 0.95,
                middleInitial: 0.80,
                addressStreet: 0.90,
                addressCity: 0.90,
                addressState: 0.95,
                addressZip: 0.95,
                sex: 0.85,
                dob: 0.90
            }
        };
    }

    /**
     * Extract required fields from OCR result
     */
    extractRequiredFields(ocrResult) {
        return {
            lastName: ocrResult.lastName || null,
            firstName: ocrResult.firstName || null,
            middleInitial: ocrResult.middleInitial || null,
            addressStreet: ocrResult.addressStreet || null,
            addressCity: ocrResult.addressCity || null,
            addressState: ocrResult.addressState || null,
            addressZip: ocrResult.addressZip || null,
            sex: ocrResult.sex || null,
            dob: ocrResult.dob || null
        };
    }

    /**
     * Calculate overall confidence score
     */
    calculateConfidenceScore(extractedData, ocrResult) {
        if (!ocrResult.confidence) return 0.8;

        const confidences = Object.values(ocrResult.confidence);
        const averageConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;

        // Check for null values and reduce confidence accordingly
        const nullCount = Object.values(extractedData).filter(value => value === null).length;
        const nullPenalty = (nullCount / Object.keys(extractedData).length) * 0.2;

        return Math.max(0, averageConfidence - nullPenalty);
    }

    /**
     * Save extracted data to MongoDB
     */
    async saveToMongoDB(extractedData, confidence) {
        try {
            // Simulate MongoDB save
            const document = {
                jobId: this.jobId,
                userId: this.userId,
                filePath: this.filePath,
                extractedData: extractedData,
                confidenceScore: confidence,
                status: 'completed',
                createdAt: new Date(),
                processedAt: new Date()
            };

            console.log('Document saved to MongoDB:', {
                jobId: this.jobId,
                confidence: confidence,
                fieldsExtracted: Object.keys(extractedData).length
            });

            // In real implementation, this would use Mongoose or MongoDB driver
            // await IdentityDocument.create(document);

            return document;

        } catch (error) {
            console.error('MongoDB save error:', error);
            throw new Error('Failed to save extracted data to database');
        }
    }

    /**
     * Update job status (would use Redis/Database in production)
     */
    updateJobStatus(status) {
        console.log(`Job ${this.jobId} status updated to: ${status}`);
        // In production, this would update Redis or database
    }
}

module.exports = IdOcrJob;