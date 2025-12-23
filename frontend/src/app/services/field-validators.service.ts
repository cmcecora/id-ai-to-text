/**
 * FieldValidatorsService
 * 
 * Provides bulletproof validation for extracted voice/OCR data with confidence scoring.
 * This mirrors the validation approach used in the backend TranscriptionExtractJob.
 */

import { Injectable } from '@angular/core';

// US States for validation
export const US_STATES: string[] = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// State name to abbreviation map
export const STATE_NAME_MAP: { [key: string]: string } = {
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

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  normalizedValue: any;
  error?: string;
  warning?: string;
}

export interface FormValidationResult {
  isValid: boolean;
  overallConfidence: number;
  fieldResults: { [field: string]: ValidationResult };
  errors: { [field: string]: string };
  warnings: { [field: string]: string };
  fieldsNeedingReview: string[];
}

@Injectable({
  providedIn: 'root'
})
export class FieldValidatorsService {
  // Confidence threshold for flagging fields as needing review
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  constructor() {}

  /**
   * Validate a complete form and return comprehensive results
   */
  validateForm(formData: { [key: string]: any }): FormValidationResult {
    const fieldResults: { [field: string]: ValidationResult } = {};
    const errors: { [field: string]: string } = {};
    const warnings: { [field: string]: string } = {};
    const fieldsNeedingReview: string[] = [];

    // Validate each field
    for (const [field, value] of Object.entries(formData)) {
      const result = this.validateField(field, value);
      fieldResults[field] = result;

      if (result.error) {
        errors[field] = result.error;
      }
      if (result.warning) {
        warnings[field] = result.warning;
      }
      if (result.confidence < this.CONFIDENCE_THRESHOLD && !result.error) {
        fieldsNeedingReview.push(field);
      }
    }

    // Calculate overall validity and confidence
    const allResults = Object.values(fieldResults);
    const isValid = Object.keys(errors).length === 0;
    const totalConfidence = allResults.reduce((sum, r) => sum + r.confidence, 0);
    const overallConfidence = allResults.length > 0 ? totalConfidence / allResults.length : 0;

    return {
      isValid,
      overallConfidence,
      fieldResults,
      errors,
      warnings,
      fieldsNeedingReview
    };
  }

  /**
   * Validate a single field and return its validation result
   */
  validateField(fieldName: string, value: any): ValidationResult {
    if (value === undefined || value === null || value === '') {
      return {
        isValid: true, // Empty is valid (not required here)
        confidence: 0,
        normalizedValue: '',
        warning: `${this.getFieldLabel(fieldName)} is empty`
      };
    }

    switch (fieldName) {
      case 'firstName':
      case 'lastName':
        return this.validateName(value, fieldName);
      
      case 'dob':
        return this.validateDateOfBirth(value);
      
      case 'sex':
        return this.validateSex(value);
      
      case 'email':
        return this.validateEmail(value);
      
      case 'phone':
        return this.validatePhone(value);
      
      case 'addressStreet':
        return this.validateAddressStreet(value);
      
      case 'addressCity':
        return this.validateCity(value);
      
      case 'addressState':
        return this.validateState(value);
      
      case 'addressZip':
        return this.validateZipCode(value);
      
      case 'insuranceProvider':
        return this.validateInsuranceProvider(value);
      
      case 'insuranceId':
      case 'memberId':
        return this.validateInsuranceId(value);
      
      default:
        // Unknown field - return with medium confidence
        return {
          isValid: true,
          confidence: 0.7,
          normalizedValue: value
        };
    }
  }

  /**
   * Validate name field (firstName, lastName)
   */
  private validateName(value: string, fieldName: string): ValidationResult {
    const trimmed = String(value).trim();
    
    // Remove non-letter characters except spaces, hyphens, apostrophes
    const cleaned = trimmed.replace(/[^a-zA-Z\s'-]/g, '');
    
    if (cleaned.length < 2) {
      return {
        isValid: false,
        confidence: 0.3,
        normalizedValue: cleaned,
        error: `${this.getFieldLabel(fieldName)} is too short`
      };
    }

    // Normalize to Title Case
    const normalized = cleaned
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Check for proper name format
    const isProperFormat = /^[A-Z][a-z]+(?:[-'\s][A-Z][a-z]+)*$/.test(normalized);
    
    return {
      isValid: true,
      confidence: isProperFormat ? 0.95 : 0.75,
      normalizedValue: normalized,
      warning: isProperFormat ? undefined : 'Name format may need review'
    };
  }

  /**
   * Validate date of birth
   */
  private validateDateOfBirth(value: any): ValidationResult {
    let dateStr: string;
    
    // Handle Date objects
    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        return {
          isValid: false,
          confidence: 0,
          normalizedValue: null,
          error: 'Invalid date'
        };
      }
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else {
      dateStr = String(value).trim();
    }

    // Already in YYYY-MM-DD format
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1]);
      const month = parseInt(isoMatch[2]);
      const day = parseInt(isoMatch[3]);
      
      if (this.isValidDateComponents(year, month, day)) {
        return {
          isValid: true,
          confidence: 0.95,
          normalizedValue: dateStr
        };
      }
    }

    // Try MM/DD/YYYY format
    const slashMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (slashMatch) {
      const month = parseInt(slashMatch[1]);
      const day = parseInt(slashMatch[2]);
      let year = parseInt(slashMatch[3]);
      
      if (year < 100) {
        year = year > 50 ? 1900 + year : 2000 + year;
      }
      
      if (this.isValidDateComponents(year, month, day)) {
        const normalized = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return {
          isValid: true,
          confidence: 0.85,
          normalizedValue: normalized
        };
      }
    }

    return {
      isValid: false,
      confidence: 0.3,
      normalizedValue: dateStr,
      error: 'Invalid date format (use YYYY-MM-DD)'
    };
  }

  /**
   * Check if date components are valid
   */
  private isValidDateComponents(year: number, month: number, day: number): boolean {
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > new Date().getFullYear()) return false;
    
    // Create date and verify it's valid
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
  }

  /**
   * Validate sex/gender field
   */
  private validateSex(value: string): ValidationResult {
    const upper = String(value).trim().toUpperCase();
    const lower = String(value).trim().toLowerCase();

    // Direct matches
    if (['M', 'F'].includes(upper)) {
      return {
        isValid: true,
        confidence: 0.95,
        normalizedValue: upper
      };
    }

    // Normalize common variations
    if (['MALE', 'MAN', 'BOY'].includes(upper)) {
      return {
        isValid: true,
        confidence: 0.9,
        normalizedValue: 'M'
      };
    }

    if (['FEMALE', 'WOMAN', 'GIRL'].includes(upper)) {
      return {
        isValid: true,
        confidence: 0.9,
        normalizedValue: 'F'
      };
    }

    return {
      isValid: false,
      confidence: 0.3,
      normalizedValue: upper,
      error: 'Sex must be M or F'
    };
  }

  /**
   * Validate email address
   */
  private validateEmail(value: string): ValidationResult {
    let email = String(value).toLowerCase().trim();

    // Fix common spoken email patterns
    email = email.replace(/\s+at\s+/gi, '@');
    email = email.replace(/\s+dot\s+/gi, '.');
    email = email.replace(/\s+/g, '');

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (emailRegex.test(email)) {
      return {
        isValid: true,
        confidence: 0.95,
        normalizedValue: email
      };
    }

    // Check if it's close to a valid email
    if (email.includes('@') && email.includes('.')) {
      return {
        isValid: false,
        confidence: 0.5,
        normalizedValue: email,
        warning: 'Email format may be incorrect'
      };
    }

    return {
      isValid: false,
      confidence: 0.2,
      normalizedValue: email,
      error: 'Invalid email format'
    };
  }

  /**
   * Validate phone number
   */
  private validatePhone(value: string): ValidationResult {
    // Extract digits only
    let digits = String(value).replace(/\D/g, '');

    // Remove country code if present
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    }

    if (digits.length === 10) {
      // Format as (XXX) XXX-XXXX
      const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      return {
        isValid: true,
        confidence: 0.95,
        normalizedValue: formatted
      };
    }

    if (digits.length > 0 && digits.length < 10) {
      return {
        isValid: false,
        confidence: 0.4,
        normalizedValue: digits,
        warning: 'Phone number appears incomplete'
      };
    }

    if (digits.length > 10) {
      return {
        isValid: false,
        confidence: 0.5,
        normalizedValue: digits,
        warning: 'Phone number has too many digits'
      };
    }

    return {
      isValid: false,
      confidence: 0.2,
      normalizedValue: value,
      error: 'Invalid phone number'
    };
  }

  /**
   * Validate street address
   */
  private validateAddressStreet(value: string): ValidationResult {
    const trimmed = String(value).trim();

    if (trimmed.length < 5) {
      return {
        isValid: false,
        confidence: 0.3,
        normalizedValue: trimmed,
        warning: 'Street address appears too short'
      };
    }

    // Check for street number at the beginning
    const hasStreetNumber = /^\d+\s+/.test(trimmed);
    
    // Check for common street suffixes
    const hasStreetSuffix = /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place|cir|circle)\b/i.test(trimmed);

    let confidence = 0.7;
    if (hasStreetNumber) confidence += 0.15;
    if (hasStreetSuffix) confidence += 0.1;

    return {
      isValid: true,
      confidence: Math.min(confidence, 0.95),
      normalizedValue: trimmed,
      warning: !hasStreetNumber ? 'Street address may be missing number' : undefined
    };
  }

  /**
   * Validate city name
   */
  private validateCity(value: string): ValidationResult {
    const trimmed = String(value).trim();

    if (trimmed.length < 2) {
      return {
        isValid: false,
        confidence: 0.2,
        normalizedValue: trimmed,
        error: 'City name is too short'
      };
    }

    // Normalize to Title Case
    const normalized = trimmed
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Check for valid city name pattern
    const isValidPattern = /^[A-Z][a-z]+(?:[-\s][A-Z][a-z]+)*$/.test(normalized);

    return {
      isValid: true,
      confidence: isValidPattern ? 0.85 : 0.65,
      normalizedValue: normalized
    };
  }

  /**
   * Validate state code
   */
  private validateState(value: string): ValidationResult {
    const upper = String(value).toUpperCase().trim();
    const lower = String(value).toLowerCase().trim();

    // Direct 2-letter code match
    if (US_STATES.includes(upper)) {
      return {
        isValid: true,
        confidence: 0.95,
        normalizedValue: upper
      };
    }

    // Try full state name
    if (STATE_NAME_MAP[lower]) {
      return {
        isValid: true,
        confidence: 0.9,
        normalizedValue: STATE_NAME_MAP[lower]
      };
    }

    return {
      isValid: false,
      confidence: 0.3,
      normalizedValue: upper,
      error: 'Invalid state code'
    };
  }

  /**
   * Validate ZIP code
   */
  private validateZipCode(value: string): ValidationResult {
    const digits = String(value).replace(/\D/g, '');

    // 5-digit ZIP
    if (/^\d{5}$/.test(digits)) {
      return {
        isValid: true,
        confidence: 0.95,
        normalizedValue: digits
      };
    }

    // ZIP+4 format
    if (/^\d{9}$/.test(digits)) {
      const formatted = `${digits.slice(0, 5)}-${digits.slice(5)}`;
      return {
        isValid: true,
        confidence: 0.95,
        normalizedValue: formatted
      };
    }

    // Already formatted ZIP+4
    if (/^\d{5}-\d{4}$/.test(value)) {
      return {
        isValid: true,
        confidence: 0.95,
        normalizedValue: value
      };
    }

    return {
      isValid: false,
      confidence: 0.3,
      normalizedValue: digits,
      error: 'Invalid ZIP code format'
    };
  }

  /**
   * Validate insurance provider name
   */
  private validateInsuranceProvider(value: string): ValidationResult {
    const trimmed = String(value).trim();
    const lower = trimmed.toLowerCase();

    // Known insurance providers
    const knownProviders: { [key: string]: string } = {
      'blue cross': 'Blue Cross Blue Shield',
      'blue shield': 'Blue Cross Blue Shield',
      'bcbs': 'Blue Cross Blue Shield',
      'aetna': 'Aetna',
      'cigna': 'Cigna',
      'united': 'UnitedHealthcare',
      'united healthcare': 'UnitedHealthcare',
      'unitedhealthcare': 'UnitedHealthcare',
      'humana': 'Humana',
      'kaiser': 'Kaiser Permanente',
      'kaiser permanente': 'Kaiser Permanente',
      'anthem': 'Anthem',
      'medicare': 'Medicare',
      'medicaid': 'Medicaid',
      'oscar': 'Oscar',
      'molina': 'Molina',
      'tricare': 'TRICARE',
      'emblem': 'EmblemHealth',
      'emblemhealth': 'EmblemHealth',
      'oxford': 'Oxford',
      'fidelis': 'Fidelis',
      'healthfirst': 'Healthfirst',
      'metroplus': 'MetroPlus',
      'amerigroup': 'Amerigroup',
      'wellcare': 'WellCare',
      'highmark': 'Highmark'
    };

    for (const [key, normalized] of Object.entries(knownProviders)) {
      if (lower.includes(key)) {
        return {
          isValid: true,
          confidence: 0.95,
          normalizedValue: normalized
        };
      }
    }

    // Unknown but potentially valid provider
    if (trimmed.length >= 3) {
      const titleCased = trimmed
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      return {
        isValid: true,
        confidence: 0.7,
        normalizedValue: titleCased,
        warning: 'Insurance provider not recognized - please verify'
      };
    }

    return {
      isValid: false,
      confidence: 0.3,
      normalizedValue: trimmed,
      error: 'Invalid insurance provider'
    };
  }

  /**
   * Validate insurance ID/member ID
   */
  private validateInsuranceId(value: string): ValidationResult {
    // Clean and uppercase
    const cleaned = String(value).replace(/[\s-]/g, '').toUpperCase();

    // Valid ID is typically 6-15 alphanumeric characters
    if (/^[A-Z0-9]{6,15}$/.test(cleaned)) {
      return {
        isValid: true,
        confidence: 0.9,
        normalizedValue: cleaned
      };
    }

    // Shorter but still alphanumeric
    if (/^[A-Z0-9]{3,5}$/.test(cleaned)) {
      return {
        isValid: true,
        confidence: 0.7,
        normalizedValue: cleaned,
        warning: 'Insurance ID appears short'
      };
    }

    // Has some valid characters
    if (cleaned.length >= 3) {
      return {
        isValid: true,
        confidence: 0.5,
        normalizedValue: cleaned,
        warning: 'Insurance ID format may be incorrect'
      };
    }

    return {
      isValid: false,
      confidence: 0.2,
      normalizedValue: cleaned,
      error: 'Invalid insurance ID'
    };
  }

  /**
   * Get human-readable field label
   */
  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      'firstName': 'First name',
      'lastName': 'Last name',
      'dob': 'Date of birth',
      'sex': 'Sex',
      'email': 'Email',
      'phone': 'Phone',
      'addressStreet': 'Street address',
      'addressCity': 'City',
      'addressState': 'State',
      'addressZip': 'ZIP code',
      'insuranceProvider': 'Insurance provider',
      'insuranceId': 'Insurance ID',
      'memberId': 'Member ID'
    };

    return labels[fieldName] || fieldName;
  }
}

