const mongoose = require('mongoose');

/**
 * TranscriptDocument Model - Mongoose schema for storing voice transcript extraction results
 * This mirrors the IdentityDocument model but is optimized for audio/transcript processing
 *
 * Supports three source types:
 * - vapi_call: Real-time VAPI voice calls with post-call refinement
 * - audio_upload: Uploaded audio files transcribed via Whisper
 * - text_input: Direct text transcript input
 */
const transcriptDocumentSchema = new mongoose.Schema({
    // Job tracking
    jobId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // User association
    userId: {
        type: String,
        required: true,
        index: true
    },

    // Source information
    sourceType: {
        type: String,
        enum: ['vapi_call', 'audio_upload', 'text_input'],
        required: true,
        index: true
    },

    // VAPI-specific fields
    vapiCallId: {
        type: String,
        index: true,
        sparse: true
    },

    // Audio upload fields
    audioFilePath: {
        type: String
    },

    originalFileName: {
        type: String
    },

    fileSize: {
        type: Number
    },

    mimeType: {
        type: String
    },

    audioDuration: {
        type: Number // Duration in seconds
    },

    // Raw transcript data
    rawTranscript: {
        type: String,
        required: true
    },

    transcriptWordCount: {
        type: Number
    },

    // Processing Status
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
        index: true
    },

    // Extracted data fields (patient form fields)
    extractedData: {
        firstName: {
            type: String,
            trim: true
        },
        lastName: {
            type: String,
            trim: true
        },
        dob: {
            type: String, // YYYY-MM-DD format string for consistency
            validate: {
                validator: function(v) {
                    if (!v) return true;
                    return /^\d{4}-\d{2}-\d{2}$/.test(v);
                },
                message: 'Date of birth must be in YYYY-MM-DD format'
            }
        },
        sex: {
            type: String,
            enum: ['M', 'F', null],
            uppercase: true
        },
        addressStreet: {
            type: String,
            trim: true
        },
        addressCity: {
            type: String,
            trim: true
        },
        addressState: {
            type: String,
            trim: true,
            uppercase: true,
            maxlength: 2
        },
        addressZip: {
            type: String,
            trim: true,
            validate: {
                validator: function(v) {
                    if (!v) return true;
                    return /^\d{5}(-\d{4})?$/.test(v);
                },
                message: 'ZIP code must be in format 12345 or 12345-6789'
            }
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            validate: {
                validator: function(v) {
                    if (!v) return true;
                    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
                },
                message: 'Invalid email format'
            }
        },
        phone: {
            type: String,
            trim: true,
            validate: {
                validator: function(v) {
                    if (!v) return true;
                    // Allow 10 digits only
                    return /^\d{10}$/.test(v.replace(/\D/g, ''));
                },
                message: 'Phone must be 10 digits'
            }
        },
        insuranceProvider: {
            type: String,
            trim: true
        },
        memberId: {
            type: String,
            trim: true,
            uppercase: true
        }
    },

    // Real-time data collected during VAPI call (before refinement)
    realtimeData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Real-time confidence scores
    realtimeConfidence: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Final confidence scores for each extracted field (0.0 - 1.0)
    confidenceScores: {
        firstName: { type: Number, min: 0, max: 1 },
        lastName: { type: Number, min: 0, max: 1 },
        dob: { type: Number, min: 0, max: 1 },
        sex: { type: Number, min: 0, max: 1 },
        addressStreet: { type: Number, min: 0, max: 1 },
        addressCity: { type: Number, min: 0, max: 1 },
        addressState: { type: Number, min: 0, max: 1 },
        addressZip: { type: Number, min: 0, max: 1 },
        email: { type: Number, min: 0, max: 1 },
        phone: { type: Number, min: 0, max: 1 },
        insuranceProvider: { type: Number, min: 0, max: 1 },
        memberId: { type: Number, min: 0, max: 1 }
    },

    // Overall confidence score
    overallConfidence: {
        type: Number,
        min: 0,
        max: 1
    },

    // Track where each field value came from (for audit trail)
    fieldSources: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
        // Example: { firstName: 'realtime', lastName: 'post_call', email: 'user_edit' }
    },

    // Flag for manual review requirement
    requiresManualReview: {
        type: Boolean,
        default: false
    },

    // Error information (if processing failed)
    errorMessage: {
        type: String
    },

    // Processing metadata
    processingTime: {
        type: Number // in milliseconds
    },

    anthropicModel: {
        type: String
    },

    anthropicTokensUsed: {
        type: Number
    },

    // Retry tracking
    retryCount: {
        type: Number,
        default: 0
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    updatedAt: {
        type: Date,
        default: Date.now
    },

    processedAt: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
transcriptDocumentSchema.index({ userId: 1, createdAt: -1 });
transcriptDocumentSchema.index({ status: 1, createdAt: -1 });
transcriptDocumentSchema.index({ sourceType: 1, createdAt: -1 });
transcriptDocumentSchema.index({ vapiCallId: 1 }, { sparse: true });
transcriptDocumentSchema.index({ 'extractedData.lastName': 1, 'extractedData.firstName': 1 });

// Virtual fields
transcriptDocumentSchema.virtual('fullName').get(function() {
    const { firstName, lastName } = this.extractedData || {};
    return [firstName, lastName].filter(Boolean).join(' ');
});

transcriptDocumentSchema.virtual('fullAddress').get(function() {
    const { addressStreet, addressCity, addressState, addressZip } = this.extractedData || {};
    return [addressStreet, addressCity, addressState, addressZip].filter(Boolean).join(', ');
});

// Pre-save middleware
transcriptDocumentSchema.pre('save', function(next) {
    this.updatedAt = new Date();

    // Calculate word count if not set
    if (this.rawTranscript && !this.transcriptWordCount) {
        this.transcriptWordCount = this.rawTranscript.split(/\s+/).filter(Boolean).length;
    }

    // Calculate overall confidence if not set
    if (!this.overallConfidence && this.confidenceScores) {
        const scores = Object.values(this.confidenceScores).filter(
            score => score !== null && score !== undefined
        );
        if (scores.length > 0) {
            this.overallConfidence = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        }
    }

    // Set processedAt when status changes to completed
    if (this.isModified('status') && this.status === 'completed' && !this.processedAt) {
        this.processedAt = new Date();
    }

    // Auto-flag for manual review if confidence is too low
    if (this.overallConfidence && this.overallConfidence < 0.5) {
        this.requiresManualReview = true;
    }

    next();
});

// Static methods
transcriptDocumentSchema.statics.findByUserId = function(userId) {
    return this.find({ userId }).sort({ createdAt: -1 });
};

transcriptDocumentSchema.statics.findByStatus = function(status) {
    return this.find({ status }).sort({ createdAt: -1 });
};

transcriptDocumentSchema.statics.findByJobId = function(jobId) {
    return this.findOne({ jobId });
};

transcriptDocumentSchema.statics.findByVapiCallId = function(vapiCallId) {
    return this.findOne({ vapiCallId });
};

transcriptDocumentSchema.statics.findPending = function() {
    return this.find({ status: 'pending' }).sort({ createdAt: 1 });
};

transcriptDocumentSchema.statics.findRequiringReview = function() {
    return this.find({ requiresManualReview: true, status: 'completed' }).sort({ createdAt: -1 });
};

// Instance methods
transcriptDocumentSchema.methods.isCompleted = function() {
    return this.status === 'completed';
};

transcriptDocumentSchema.methods.hasError = function() {
    return this.status === 'failed';
};

transcriptDocumentSchema.methods.getExtractedField = function(fieldName) {
    return this.extractedData ? this.extractedData[fieldName] : null;
};

transcriptDocumentSchema.methods.getFieldConfidence = function(fieldName) {
    return this.confidenceScores ? this.confidenceScores[fieldName] : null;
};

transcriptDocumentSchema.methods.getFieldSource = function(fieldName) {
    return this.fieldSources ? this.fieldSources[fieldName] : null;
};

// Get low confidence fields (below threshold)
transcriptDocumentSchema.methods.getLowConfidenceFields = function(threshold = 0.7) {
    const lowFields = [];
    if (this.confidenceScores) {
        for (const [field, score] of Object.entries(this.confidenceScores)) {
            if (score !== null && score !== undefined && score < threshold) {
                lowFields.push({ field, score });
            }
        }
    }
    return lowFields.sort((a, b) => a.score - b.score);
};

// Validation method
transcriptDocumentSchema.methods.validateExtractedData = function() {
    const errors = [];
    const warnings = [];
    const data = this.extractedData || {};

    // Check required fields
    if (!data.firstName || data.firstName.trim() === '') {
        warnings.push('First name is missing');
    } else if (data.firstName.length < 2) {
        errors.push('First name is too short');
    }

    if (!data.lastName || data.lastName.trim() === '') {
        warnings.push('Last name is missing');
    } else if (data.lastName.length < 2) {
        errors.push('Last name is too short');
    }

    // DOB validation
    if (data.dob) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dob)) {
            errors.push('Date of birth must be in YYYY-MM-DD format');
        } else {
            const dobDate = new Date(data.dob);
            const today = new Date();
            const age = Math.floor((today - dobDate) / (365.25 * 24 * 60 * 60 * 1000));
            if (age < 1 || age > 120) {
                errors.push('Date of birth appears invalid');
            }
        }
    } else {
        warnings.push('Date of birth is missing');
    }

    // Sex validation
    if (data.sex && !['M', 'F'].includes(data.sex)) {
        errors.push('Sex must be M or F');
    }

    // State validation
    const validStates = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    ];
    if (data.addressState && !validStates.includes(data.addressState)) {
        errors.push('Invalid US state abbreviation');
    }

    // ZIP validation
    if (data.addressZip && !/^\d{5}(-\d{4})?$/.test(data.addressZip)) {
        errors.push('Invalid ZIP code format');
    }

    // Email validation
    if (data.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(data.email)) {
        errors.push('Invalid email format');
    }

    // Phone validation
    if (data.phone) {
        const digits = data.phone.replace(/\D/g, '');
        if (digits.length !== 10) {
            errors.push('Phone number must be 10 digits');
        }
    }

    return { errors, warnings, isValid: errors.length === 0 };
};

// Mark field as user-edited (sets confidence > 1.0 to prevent overwriting)
transcriptDocumentSchema.methods.markFieldAsUserEdited = function(fieldName) {
    if (!this.confidenceScores) {
        this.confidenceScores = {};
    }
    if (!this.fieldSources) {
        this.fieldSources = {};
    }

    // Confidence > 1.0 indicates user edit - should never be overwritten
    this.confidenceScores[fieldName] = 1.5;
    this.fieldSources[fieldName] = 'user_edit';
};

// Compile the model
const TranscriptDocument = mongoose.model('TranscriptDocument', transcriptDocumentSchema);

module.exports = TranscriptDocument;
