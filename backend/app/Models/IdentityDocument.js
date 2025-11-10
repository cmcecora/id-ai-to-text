const mongoose = require('mongoose');

/**
 * IdentityDocument Model - Mongoose schema for storing OCR results
 * This represents the Laravel Eloquent model equivalent
 */
const identityDocumentSchema = new mongoose.Schema({
    // Job tracking
    jobId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // User association (from Laravel Auth)
    userId: {
        type: String,
        required: true,
        index: true
    },

    // File information
    filePath: {
        type: String,
        required: true
    },

    originalFileName: {
        type: String,
        required: true
    },

    fileSize: {
        type: Number,
        required: true
    },

    mimeType: {
        type: String,
        required: true
    },

    // OCR Processing Status
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
        index: true
    },

    // Extracted data fields (required by acceptance criteria)
    extractedData: {
        idNumber: {
            type: String,
            trim: true,
            uppercase: true
        },
        lastName: {
            type: String,
            trim: true,
            uppercase: true
        },
        firstName: {
            type: String,
            trim: true,
            uppercase: true
        },
        middleInitial: {
            type: String,
            trim: true,
            uppercase: true,
            maxlength: 1
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
                    return /^\d{5}(-\d{4})?$/.test(v);
                },
                message: 'ZIP code must be in format 12345 or 12345-6789'
            }
        },
        sex: {
            type: String,
            enum: ['M', 'F', 'Other', null],
            uppercase: true
        },
        dob: {
            type: Date,
            validate: {
                validator: function(v) {
                    if (!v) return true; // Allow null/undefined

                    if (!(v instanceof Date) || isNaN(v.getTime())) {
                        return false; // Invalid date
                    }

                    const today = new Date();
                    const birthDate = new Date(v);

                    // Check if date is not in the future
                    if (birthDate > today) {
                        return false;
                    }

                    // Check if person is not too old (120 years)
                    const maxAge = 120;
                    const minDate = new Date();
                    minDate.setFullYear(minDate.getFullYear() - maxAge);

                    if (birthDate < minDate) {
                        return false;
                    }

                    // Check if person is at least 1 year old
                    const minAge = 1;
                    const recentDate = new Date();
                    recentDate.setFullYear(recentDate.getFullYear() - minAge);

                    if (birthDate > recentDate) {
                        return false;
                    }

                    return true;
                },
                message: 'Date of birth must be a valid date between 1 and 120 years ago'
            }
        }
    },

    // Confidence scores for each field
    confidenceScores: {
        idNumber: { type: Number, min: 0, max: 1 },
        lastName: { type: Number, min: 0, max: 1 },
        firstName: { type: Number, min: 0, max: 1 },
        middleInitial: { type: Number, min: 0, max: 1 },
        addressStreet: { type: Number, min: 0, max: 1 },
        addressCity: { type: Number, min: 0, max: 1 },
        addressState: { type: Number, min: 0, max: 1 },
        addressZip: { type: Number, min: 0, max: 1 },
        sex: { type: Number, min: 0, max: 1 },
        dob: { type: Number, min: 0, max: 1 }
    },

    // Overall confidence score
    overallConfidence: {
        type: Number,
        min: 0,
        max: 1
    },

    // Error information (if processing failed)
    errorMessage: {
        type: String
    },

    // Processing metadata
    processingTime: {
        type: Number // in milliseconds
    },

    // Timestamps (Laravel equivalent of created_at, updated_at)
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
    // Enable automatic timestamps
    timestamps: true,
    // Use Laravel-style field names
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance (Laravel migration equivalent)
identityDocumentSchema.index({ userId: 1, createdAt: -1 });
identityDocumentSchema.index({ status: 1, createdAt: -1 });
identityDocumentSchema.index({ 'extractedData.lastName': 1, 'extractedData.firstName': 1 });

// Virtual fields for Laravel-style accessors
identityDocumentSchema.virtual('fullName').get(function() {
    const { firstName, lastName, middleInitial } = this.extractedData;
    return [firstName, middleInitial, lastName].filter(Boolean).join(' ');
});

identityDocumentSchema.virtual('fullAddress').get(function() {
    const { addressStreet, addressCity, addressState, addressZip } = this.extractedData;
    return [addressStreet, addressCity, addressState, addressZip].filter(Boolean).join(', ');
});

// Pre-save middleware (Laravel equivalent of model events)
identityDocumentSchema.pre('save', function(next) {
    this.updatedAt = new Date();

    // Calculate overall confidence if not set
    if (!this.overallConfidence && this.confidenceScores) {
        const scores = Object.values(this.confidenceScores).filter(score => score !== null && score !== undefined);
        if (scores.length > 0) {
            this.overallConfidence = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        }
    }

    // Set processedAt when status changes to completed
    if (this.isModified('status') && this.status === 'completed' && !this.processedAt) {
        this.processedAt = new Date();
    }

    next();
});

// Static methods (Laravel equivalent of model scopes)
identityDocumentSchema.statics.findByUserId = function(userId) {
    return this.find({ userId: userId }).sort({ createdAt: -1 });
};

identityDocumentSchema.statics.findByStatus = function(status) {
    return this.find({ status: status }).sort({ createdAt: -1 });
};

identityDocumentSchema.statics.findByJobId = function(jobId) {
    return this.findOne({ jobId: jobId });
};

// Instance methods (Laravel equivalent of model methods)
identityDocumentSchema.methods.isCompleted = function() {
    return this.status === 'completed';
};

identityDocumentSchema.methods.hasError = function() {
    return this.status === 'failed';
};

identityDocumentSchema.methods.getExtractedField = function(fieldName) {
    return this.extractedData[fieldName] || null;
};

identityDocumentSchema.methods.getFieldConfidence = function(fieldName) {
    return this.confidenceScores ? this.confidenceScores[fieldName] : null;
};

// Validation method
identityDocumentSchema.methods.validateExtractedData = function() {
    const errors = [];
    const data = this.extractedData;

    // Required fields
    const requiredFields = ['lastName', 'firstName', 'addressStreet', 'addressCity', 'addressState', 'addressZip'];
    requiredFields.forEach(field => {
        if (!data[field] || data[field].trim() === '') {
            errors.push(`${field} is required`);
        }
    });

    // ZIP code validation
    if (data.addressZip && !/^\d{5}(-\d{4})?$/.test(data.addressZip)) {
        errors.push('Invalid ZIP code format');
    }

    // State validation (US states)
    const validStates = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
                        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
                        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
                        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
                        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];

    if (data.addressState && !validStates.includes(data.addressState)) {
        errors.push('Invalid US state abbreviation');
    }

    return errors;
};

// Compile the model
const IdentityDocument = mongoose.model('IdentityDocument', identityDocumentSchema);

module.exports = IdentityDocument;