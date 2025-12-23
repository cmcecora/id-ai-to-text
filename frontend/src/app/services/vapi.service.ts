// src/app/services/vapi.service.ts
import { Injectable, EventEmitter } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import Vapi from '@vapi-ai/web';

// Interface for booking form data collected via voice (incremental updates)
// Field names are CANONICAL - the normalizeFieldName() method maps any Vapi field name to these
// FIELD ORDER (one raw answer per question):
// 1. test, 2. reasons, 3. preferredLocation, 4. preferredDate, 5. preferredTime,
// 6. firstName, 7. lastName, 8. dob, 9. sex, 10. address (full string), 11. email,
// 12. phone, 13. insuranceProvider, 14. insuranceId
export interface VoiceBookingData {
  test?: string;              // 1. What test do they want?
  reasons?: string;           // 2. Why do they need this test?
  preferredLocation?: string; // 3. Where? (city, state, or zipcode)
  preferredDate?: string;     // 4. When? (date in words or numbers)
  preferredTime?: string;     // 5. What time? (time in words or numbers)
  firstName?: string;         // 6. First name
  lastName?: string;          // 7. Last name
  dob?: string;               // 8. Date of birth (words or numbers)
  sex?: string;               // 9. Sex (male or female)
  address?: string;           // 10. Full address string (parsed later by cleanup)
  email?: string;             // 11. Email address
  phone?: string;             // 12. Phone number (just numbers)
  insuranceProvider?: string; // 13. Insurance company name
  insuranceId?: string;       // 14. Insurance ID / Member ID
  hasDoctorOrder?: boolean;   // Extra: Has doctor's order?
}

// Interface for the complete appointment booking (final submission)
export interface AppointmentBookingData {
  tests: string[];
  preferred_date: string;
  preferred_time: string;
  location: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
  address: string;
  email: string;
  phone_number: string;
  payment_method: string;
  insurance_carrier?: string;
  insurance_id?: string;
  needs_doctor_order: boolean;
  reason_for_test: string;
}

// Interface for tool call messages from Vapi
export interface VapiToolCall {
  type: 'tool-calls';
  toolCalls: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

// Interface for extracted data with confidence scores (mirrors OCR approach)
export interface ExtractedDataWithConfidence {
  data: VoiceBookingData;
  confidence: { [key: string]: number };
  overallConfidence: number;
}

// US States for validation
const US_STATES: string[] = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// State name to abbreviation map
const STATE_NAME_MAP: { [key: string]: string } = {
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

// Interface for post-call refinement response
export interface RefinementResponse {
  success: boolean;
  data?: {
    job_id: string;
    status: string;
    extracted_data: VoiceBookingData;
    confidence: { [key: string]: number };
    overall_confidence: number;
    field_sources: { [key: string]: string };
    requires_manual_review: boolean;
    processing_time: number;
  };
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VapiService {
  private vapi: Vapi;

  // Your assistant ID
  private assistantId = '8bc37d6f-3d2f-48d8-a6cd-dd7a0b9d6eba';

  // Subject to emit booking form data updates (incremental)
  private bookingDataSubject = new Subject<VoiceBookingData>();
  public bookingData$ = this.bookingDataSubject.asObservable();

  // Subject to emit final appointment booking data
  private appointmentBookingSubject = new Subject<AppointmentBookingData>();
  public appointmentBooking$ = this.appointmentBookingSubject.asObservable();

  // Subject to emit refined data after post-call processing
  private refinedDataSubject = new Subject<ExtractedDataWithConfidence>();
  public refinedData$ = this.refinedDataSubject.asObservable();

  // Accumulated booking data from the conversation
  private collectedData: VoiceBookingData = {};

  // Store tool call callbacks
  private toolCallCallbacks: ((toolCall: AppointmentBookingData) => void)[] = [];

  // Track conversation transcript for post-call refinement
  private conversationTranscript: string[] = [];
  private currentVapiCallId: string | null = null;

  // API URL for backend services
  private apiUrl = environment.apiUrl || 'http://localhost:8010';

  constructor(private http: HttpClient) {
    // Use your PUBLIC key (starts with pk-), not the private key
    this.vapi = new Vapi('dea287ba-8a6a-42a4-865b-1c26b932968d');

    // Set up transcript collection
    this.setupTranscriptCollection();
  }

  /**
   * Set up automatic transcript collection during calls
   */
  private setupTranscriptCollection(): void {
    this.vapi.on('message', (message: any) => {
      // Collect transcript messages
      if (message.type === 'transcript' && message.transcript) {
        const role = message.role === 'user' ? 'User' : 'Assistant';
        this.conversationTranscript.push(`${role}: ${message.transcript}`);
      }

      // Also collect conversation-update messages
      if (message.type === 'conversation-update' && message.conversation) {
        // This gives us the full conversation so far
        this.conversationTranscript = message.conversation.map((msg: any) => {
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          return `${role}: ${msg.content}`;
        });
      }
    });

    // Track call ID
    this.vapi.on('call-start', () => {
      this.currentVapiCallId = `vapi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.conversationTranscript = [];
      console.log('>>> [VapiService] Call started, ID:', this.currentVapiCallId);
    });
  }

  /**
   * Get the full conversation transcript as a string
   */
  getFullTranscript(): string {
    return this.conversationTranscript.join('\n');
  }

  /**
   * Get the current VAPI call ID
   */
  getCurrentCallId(): string | null {
    return this.currentVapiCallId;
  }

  startCall() {
    // Reset collected data and confidence at the start of a new call
    this.collectedData = {};
    this.collectedConfidence = {};
    return this.vapi.start(this.assistantId);
  }

  endCall() {
    this.vapi.stop();
    this.isPaused = false;
  }

  // Track pause state
  private isPaused = false;

  /**
   * Pause the call by muting the microphone.
   * The call remains active but the user can't speak.
   * This allows resuming from where they left off.
   */
  pauseCall(): void {
    if (!this.isPaused) {
      this.vapi.setMuted(true);
      this.isPaused = true;
      console.log('>>> [VapiService] Call paused (microphone muted)');
    }
  }

  /**
   * Resume the call by unmuting the microphone.
   * The conversation continues from where it was paused.
   */
  resumeCall(): void {
    if (this.isPaused) {
      this.vapi.setMuted(false);
      this.isPaused = false;
      console.log('>>> [VapiService] Call resumed (microphone unmuted)');
    }
  }

  /**
   * Check if the call is currently paused.
   */
  isCallPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Toggle pause state.
   */
  togglePause(): boolean {
    if (this.isPaused) {
      this.resumeCall();
    } else {
      this.pauseCall();
    }
    return this.isPaused;
  }

  // Get all collected booking data
  getCollectedData(): VoiceBookingData {
    return { ...this.collectedData };
  }

  // Reset collected data and confidence scores
  resetCollectedData(): void {
    this.collectedData = {};
    this.collectedConfidence = {};
  }

  // Send tool result back to Vapi
  sendToolResult(toolCallId: string, result: any): void {
    this.vapi.send({
      type: 'add-message',
      message: {
        role: 'tool',
        toolCallId: toolCallId,
        content: JSON.stringify(result)
      }
    });
  }

  /**
   * Normalize any incoming field name to our canonical form field name.
   * Uses EXACT and SPECIFIC pattern matching to avoid incorrect mappings.
   * 
   * FIELD ORDER (one raw answer per question):
   * 1. test, 2. reasons, 3. preferredLocation, 4. preferredDate, 5. preferredTime,
   * 6. firstName, 7. lastName, 8. dob, 9. sex, 10. address (full string),
   * 11. email, 12. phone, 13. insuranceProvider, 14. insuranceId
   * 
   * IMPORTANT: Each field should capture the FULL user response for that question.
   * We use exact matching where possible to avoid cross-contamination between fields.
   */
  private normalizeFieldName(key: string): string | null {
    // Normalize the key: lowercase and remove underscores/hyphens
    const lowerKey = key.toLowerCase().replace(/[_-]/g, '');
    const originalLower = key.toLowerCase();
    
    console.log(`>>> [VapiService] normalizeFieldName input: "${key}" -> normalized: "${lowerKey}"`);
    
    // =============================================================================
    // EXACT MATCHES FIRST - these are unambiguous field names
    // =============================================================================
    
    // Exact matches for common field names (highest priority)
    const exactMatches: Record<string, string> = {
      'test': 'test',
      'testtype': 'test',
      'testname': 'test',
      'exam': 'test',
      'procedure': 'test',
      
      'reason': 'reasons',
      'reasons': 'reasons',
      'reasonfortest': 'reasons',
      'purpose': 'reasons',
      'why': 'reasons',
      
      'location': 'preferredLocation',
      'preferredlocation': 'preferredLocation',
      'cliniclocation': 'preferredLocation',
      'facility': 'preferredLocation',
      'clinic': 'preferredLocation',
      'center': 'preferredLocation',
      'where': 'preferredLocation',
      
      'date': 'preferredDate',
      'preferreddate': 'preferredDate',
      'appointmentdate': 'preferredDate',
      'day': 'preferredDate',
      'when': 'preferredDate',
      
      'time': 'preferredTime',
      'preferredtime': 'preferredTime',
      'appointmenttime': 'preferredTime',
      'hour': 'preferredTime',
      'timeslot': 'preferredTime',
      
      'firstname': 'firstName',
      'first': 'firstName',
      'fname': 'firstName',
      
      'lastname': 'lastName',
      'last': 'lastName',
      'lname': 'lastName',
      'surname': 'lastName',
      
      'dob': 'dob',
      'dateofbirth': 'dob',
      'birthday': 'dob',
      'birthdate': 'dob',
      'bday': 'dob',
      
      'sex': 'sex',
      'gender': 'sex',
      
      // ADDRESS (single raw field)
      'address': 'address',
      'addressstreet': 'address',
      'streetaddress': 'address',
      'street': 'address',
      'addresscity': 'address',
      'addressstate': 'address',
      'addresszip': 'address',
      'zipcode': 'address',
      'zip': 'address',
      'postalcode': 'address',
      'postal': 'address',
      
      'email': 'email',
      'emailaddress': 'email',
      
      'phone': 'phone',
      'phonenumber': 'phone',
      'mobile': 'phone',
      'cell': 'phone',
      'telephone': 'phone',
      'tel': 'phone',
      
      'insurance': 'insuranceProvider',
      'insuranceprovider': 'insuranceProvider',
      'insurancecarrier': 'insuranceProvider',
      'insurancecompany': 'insuranceProvider',
      'carrier': 'insuranceProvider',
      'payer': 'insuranceProvider',
      
      'insuranceid': 'insuranceId',
      'memberid': 'insuranceId',
      'policynumber': 'insuranceId',
      'subscriberid': 'insuranceId',
    };
    
    // Check for exact match first
    if (exactMatches[lowerKey]) {
      console.log(`>>> [VapiService] Exact match: "${key}" -> "${exactMatches[lowerKey]}"`);
      return exactMatches[lowerKey];
    }
    
    // =============================================================================
    // PATTERN MATCHES - only for fields that weren't matched exactly
    // These are more lenient but ordered by priority
    // =============================================================================
    
    // 1. TEST - check for test-related patterns
    if (lowerKey.includes('test') || lowerKey.includes('exam') || lowerKey.includes('procedure')) {
      return 'test';
    }
    
    // 2. REASONS - check for reason-related patterns (BEFORE location/address)
    if (lowerKey.includes('reason') || lowerKey.includes('purpose') || lowerKey.includes('why')) {
      return 'reasons';
    }
    
    // 3. LOCATION - check for location patterns
    if (lowerKey.includes('location') || lowerKey.includes('clinic') || lowerKey.includes('facility') ||
        lowerKey.includes('center') || lowerKey.includes('where') || lowerKey.includes('preferred')) {
      return 'preferredLocation';
    }
    
    // 4. DATE - check for date patterns (exclude birthday/birthdate)
    if ((lowerKey.includes('date') || lowerKey.includes('day') || lowerKey.includes('when') || lowerKey.includes('appointment')) &&
        !lowerKey.includes('birth') && !lowerKey.includes('dob')) {
      return 'preferredDate';
    }
    
    // 5. TIME - check for time patterns
    if (lowerKey.includes('time') || lowerKey.includes('hour') || lowerKey.includes('slot')) {
      return 'preferredTime';
    }
    
    // 6-7. NAMES - check for name patterns
    if (lowerKey.includes('firstname') || lowerKey.includes('first') && lowerKey.includes('name')) {
      return 'firstName';
    }
    if (lowerKey.includes('lastname') || lowerKey.includes('last') && lowerKey.includes('name') || lowerKey.includes('surname')) {
      return 'lastName';
    }
    
    // 8. DOB - check for birth-related patterns
    if (lowerKey.includes('birth') || lowerKey.includes('dob') || lowerKey.includes('bday')) {
      return 'dob';
    }
    
    // 9. SEX/GENDER
    if (lowerKey.includes('sex') || lowerKey.includes('gender')) {
      return 'sex';
    }
    
    // 10. ADDRESS - collapse to single raw address field
    if (lowerKey.includes('address') || lowerKey.includes('street') ||
        lowerKey.includes('zip') || lowerKey.includes('postal')) {
      return 'address';
    }
    
    // 14. EMAIL
    if (lowerKey.includes('email') || lowerKey.includes('mail')) {
      return 'email';
    }
    
    // 15. PHONE
    if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('cell') || lowerKey.includes('tel')) {
      return 'phone';
    }
    
    // 16-17. INSURANCE
    if (lowerKey.includes('insurance') || lowerKey.includes('carrier') || lowerKey.includes('payer')) {
      if (lowerKey.includes('id') || lowerKey.includes('member') || lowerKey.includes('policy') || lowerKey.includes('subscriber')) {
        return 'insuranceId';
      }
      return 'insuranceProvider';
    }
    
    // =============================================================================
    // AMBIGUOUS FIELDS - these are NOT automatically mapped
    // 'city' and 'state' alone are ignored because they could be:
    // - Part of an address
    // - Part of a location
    // - Something else entirely (like extracted from reasons text)
    // =============================================================================
    
    // Log but don't map ambiguous or unknown fields
    console.log(`>>> [VapiService] UNMAPPED field: "${key}" (normalized: "${lowerKey}") - field ignored`);
    return null;
  }

  // =============================================================================
  // VALUE TRANSFORMERS - Normalize values as they arrive from voice transcription
  // These mirror the bulletproof approach used in ID OCR processing
  // =============================================================================

  /**
   * Transform a value based on its field type.
   * Returns the transformed value and a confidence score.
   */
  private transformValue(fieldName: string, value: any): { value: any; confidence: number } {
    if (value === undefined || value === null || value === '') {
      return { value: null, confidence: 0 };
    }

    const stringValue = String(value).trim();
    
    switch (fieldName) {
      case 'firstName':
      case 'lastName':
        return this.transformName(stringValue);
      
      case 'sex':
        return this.transformSex(stringValue);
      
      case 'dob':
        return this.transformDateOfBirth(stringValue);
      
      case 'email':
        return this.transformEmail(stringValue);
      
      case 'phone':
        return this.transformPhone(stringValue);
      
      case 'address':
        return this.transformAddress(stringValue);
      
      case 'insuranceProvider':
        return this.transformInsuranceProvider(stringValue);
      
      case 'insuranceId':
        return this.transformInsuranceId(stringValue);
      
      default:
        // For fields without specific transformers, return as-is with medium confidence
        return { value: stringValue, confidence: 0.7 };
    }
  }

  /**
   * Transform name to Title Case
   */
  private transformName(value: string): { value: string; confidence: number } {
    const cleaned = value.replace(/[^a-zA-Z\s'-]/g, '').trim();
    if (!cleaned) return { value: '', confidence: 0 };
    
    // Title case: first letter uppercase, rest lowercase
    const titleCased = cleaned
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Higher confidence if it looks like a proper name (single word, starts with capital)
    const isProperName = /^[A-Z][a-z]+$/.test(titleCased);
    return { value: titleCased, confidence: isProperName ? 0.95 : 0.8 };
  }

  /**
   * Transform sex/gender to M or F
   */
  private transformSex(value: string): { value: string; confidence: number } {
    const lower = value.toLowerCase().trim();
    
    if (['male', 'm', 'man', 'boy'].includes(lower)) {
      return { value: 'M', confidence: 0.95 };
    }
    if (['female', 'f', 'woman', 'girl'].includes(lower)) {
      return { value: 'F', confidence: 0.95 };
    }
    
    // Partial matches
    if (lower.includes('male') || lower.includes('man')) {
      return { value: 'M', confidence: 0.8 };
    }
    if (lower.includes('female') || lower.includes('woman')) {
      return { value: 'F', confidence: 0.8 };
    }
    
    return { value: value, confidence: 0.3 };
  }

  /**
   * Transform date of birth to YYYY-MM-DD format
   */
  private transformDateOfBirth(value: string): { value: string; confidence: number } {
    // Remove ordinal suffixes (1st, 2nd, 3rd, 4th, etc.)
    let cleaned = value.replace(/(\d+)(st|nd|rd|th)/gi, '$1').trim();
    
    // Try various date formats
    
    // Format: MM/DD/YYYY or MM-DD-YYYY
    const slashMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (slashMatch) {
      const month = slashMatch[1].padStart(2, '0');
      const day = slashMatch[2].padStart(2, '0');
      let year = slashMatch[3];
      if (year.length === 2) {
        year = parseInt(year) > 50 ? '19' + year : '20' + year;
      }
      const result = `${year}-${month}-${day}`;
      return { value: result, confidence: this.isValidDate(result) ? 0.95 : 0.6 };
    }
    
    // Format: YYYY-MM-DD (already in correct format)
    const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return { value: cleaned, confidence: this.isValidDate(cleaned) ? 0.98 : 0.6 };
    }
    
    // Format: Month DD, YYYY or Month DD YYYY
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                        'july', 'august', 'september', 'october', 'november', 'december'];
    const monthMatch = cleaned.match(/^(\w+)\s+(\d{1,2}),?\s*(\d{4})$/i);
    if (monthMatch) {
      const monthIndex = monthNames.indexOf(monthMatch[1].toLowerCase());
      if (monthIndex >= 0) {
        const month = String(monthIndex + 1).padStart(2, '0');
        const day = monthMatch[2].padStart(2, '0');
        const year = monthMatch[3];
        const result = `${year}-${month}-${day}`;
        return { value: result, confidence: this.isValidDate(result) ? 0.9 : 0.5 };
      }
    }
    
    // Format: DD Month YYYY
    const dayFirstMatch = cleaned.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/i);
    if (dayFirstMatch) {
      const monthIndex = monthNames.indexOf(dayFirstMatch[2].toLowerCase());
      if (monthIndex >= 0) {
        const month = String(monthIndex + 1).padStart(2, '0');
        const day = dayFirstMatch[1].padStart(2, '0');
        const year = dayFirstMatch[3];
        const result = `${year}-${month}-${day}`;
        return { value: result, confidence: this.isValidDate(result) ? 0.9 : 0.5 };
      }
    }
    
    // Try native Date parsing as fallback
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      const result = `${year}-${month}-${day}`;
      return { value: result, confidence: 0.7 };
    }
    
    // Return original if we can't parse
    return { value: cleaned, confidence: 0.3 };
  }

  /**
   * Validate a date string in YYYY-MM-DD format
   */
  private isValidDate(dateStr: string): boolean {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > new Date().getFullYear()) return false;
    
    // Check for valid date
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
  }

  /**
   * Transform email address (handle spoken formats)
   */
  private transformEmail(value: string): { value: string; confidence: number } {
    let email = value.toLowerCase().trim();
    
    // Fix spoken email: "john at gmail dot com" -> "john@gmail.com"
    email = email.replace(/\s+at\s+/gi, '@');
    email = email.replace(/\s+dot\s+/gi, '.');
    email = email.replace(/\s+/g, '');
    
    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (emailRegex.test(email)) {
      return { value: email, confidence: 0.95 };
    }
    
    return { value: email, confidence: 0.5 };
  }

  /**
   * Transform phone number to (XXX) XXX-XXXX format
   */
  private transformPhone(value: string): { value: string; confidence: number } {
    // Extract only digits
    let digits = value.replace(/\D/g, '');
    
    // Handle country code
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    }
    
    if (digits.length === 10) {
      const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      return { value: formatted, confidence: 0.95 };
    }
    
    // Return digits if we have some but not 10
    if (digits.length > 0) {
      return { value: digits, confidence: 0.5 };
    }
    
    return { value: value, confidence: 0.3 };
  }

  /**
   * Transform address - parse and structure if possible
   */
  private transformAddress(value: string): { value: string; confidence: number } {
    const cleaned = value.trim();
    if (!cleaned) return { value: '', confidence: 0 };
    
    // Check if it looks like a valid address (has numbers and letters)
    const hasStreetNumber = /^\d+\s+/.test(cleaned);
    const hasStateOrZip = /\b[A-Z]{2}\b|\b\d{5}\b/.test(cleaned.toUpperCase());
    
    let confidence = 0.7;
    if (hasStreetNumber) confidence += 0.1;
    if (hasStateOrZip) confidence += 0.15;
    
    return { value: cleaned, confidence: Math.min(confidence, 0.95) };
  }

  /**
   * Transform insurance provider name
   */
  private transformInsuranceProvider(value: string): { value: string; confidence: number } {
    const cleaned = value.trim();
    const lower = cleaned.toLowerCase();
    
    // Known insurance providers (normalized names)
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
      'health first': 'Healthfirst',
      'metroplus': 'MetroPlus',
      'amerigroup': 'Amerigroup',
      'wellcare': 'WellCare',
      'centene': 'Centene',
      'highmark': 'Highmark'
    };
    
    for (const [key, normalized] of Object.entries(knownProviders)) {
      if (lower.includes(key)) {
        return { value: normalized, confidence: 0.95 };
      }
    }
    
    // Title case for unknown providers
    const titleCased = cleaned
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return { value: titleCased, confidence: 0.7 };
  }

  /**
   * Transform insurance ID (uppercase, alphanumeric)
   */
  private transformInsuranceId(value: string): { value: string; confidence: number } {
    // Remove spaces and common separators, uppercase
    const cleaned = value.replace(/[\s-]/g, '').toUpperCase();
    
    // Valid ID is typically 6-15 alphanumeric characters
    const isValidFormat = /^[A-Z0-9]{6,15}$/.test(cleaned);
    
    return { value: cleaned, confidence: isValidFormat ? 0.9 : 0.6 };
  }

  /**
   * Parse a full address string into components
   */
  parseAddressComponents(address: string): { 
    street?: string; 
    city?: string; 
    state?: string; 
    zip?: string;
    confidence: number;
  } {
    const result: { street?: string; city?: string; state?: string; zip?: string; confidence: number } = { confidence: 0.5 };
    if (!address) return result;

    let working = address.trim();

    // Extract ZIP code
    const zipMatch = working.match(/\b(\d{5}(?:-\d{4})?)\b/);
    if (zipMatch) {
      result.zip = zipMatch[1];
      working = working.replace(zipMatch[0], '').trim();
      result.confidence += 0.15;
    }

    // Extract state (2-letter abbreviation)
    for (const state of US_STATES) {
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
      for (const [name, abbr] of Object.entries(STATE_NAME_MAP)) {
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

  /**
   * Calculate confidence score for extracted data
   */
  calculateConfidence(data: VoiceBookingData): ExtractedDataWithConfidence {
    const fieldConfidence: { [key: string]: number } = {};
    let totalConfidence = 0;
    let fieldCount = 0;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null && value !== '') {
        const { confidence } = this.transformValue(key, value);
        fieldConfidence[key] = confidence;
        totalConfidence += confidence;
        fieldCount++;
      }
    }

    return {
      data,
      confidence: fieldConfidence,
      overallConfidence: fieldCount > 0 ? totalConfidence / fieldCount : 0
    };
  }

  // Store confidence scores for collected data
  private collectedConfidence: { [key: string]: number } = {};

  // Get confidence scores for collected data
  getCollectedConfidence(): { [key: string]: number } {
    return { ...this.collectedConfidence };
  }

  // Get collected data with confidence scores
  getCollectedDataWithConfidence(): ExtractedDataWithConfidence {
    return this.calculateConfidence(this.collectedData);
  }

  // Handle tool calls from Vapi assistant
  handleToolCall(toolCall: { id: string; function: { name: string; arguments: string | object } }): void {
    const { id, function: func } = toolCall;

    console.log('>>> [VapiService] handleToolCall received:', { id, functionName: func.name, arguments: func.arguments, argumentsType: typeof func.arguments });

    if (func.name === 'update_booking_form') {
      try {
        // Handle both string and object arguments (VAPI may send either)
        const rawParams = typeof func.arguments === 'string'
          ? JSON.parse(func.arguments)
          : func.arguments;

        console.log('>>> [VapiService] Raw params from Vapi:', rawParams);

        // Normalize field names AND transform values using the bulletproof pipeline
        const normalizedParams: VoiceBookingData = {};
        const confidenceUpdates: { [key: string]: number } = {};

        for (const [key, value] of Object.entries(rawParams)) {
          if (value === undefined || value === null || value === '') continue;
          
          const normalizedKey = this.normalizeFieldName(key);
          if (normalizedKey) {
            // Apply value transformer for this field type
            const transformed = this.transformValue(normalizedKey, value);
            
            if (transformed.value !== null && transformed.value !== '') {
              (normalizedParams as any)[normalizedKey] = transformed.value;
              confidenceUpdates[normalizedKey] = transformed.confidence;
              
              console.log(`>>> [VapiService] Mapped "${key}" -> "${normalizedKey}" = "${value}" -> "${transformed.value}" (confidence: ${transformed.confidence.toFixed(2)})`);
            }
          }
        }

        console.log('>>> [VapiService] Normalized & transformed params:', normalizedParams);
        console.log('>>> [VapiService] Confidence scores:', confidenceUpdates);

        // Merge new data with existing collected data
        // Only overwrite if new confidence is higher or field doesn't exist
        for (const [key, value] of Object.entries(normalizedParams)) {
          const existingConfidence = this.collectedConfidence[key] || 0;
          const newConfidence = confidenceUpdates[key] || 0;
          
          if (newConfidence >= existingConfidence || !(key in this.collectedData)) {
            (this.collectedData as any)[key] = value;
            this.collectedConfidence[key] = newConfidence;
          } else {
            console.log(`>>> [VapiService] Keeping existing value for "${key}" (existing confidence ${existingConfidence.toFixed(2)} > new ${newConfidence.toFixed(2)})`);
          }
        }

        console.log('>>> [VapiService] Updated collectedData:', this.collectedData);
        console.log('>>> [VapiService] Updated confidence:', this.collectedConfidence);
        console.log('>>> [VapiService] EMITTING via bookingDataSubject.next()');

        // Emit the updated data
        this.bookingDataSubject.next(this.collectedData);

        // Send success result back to Vapi
        this.sendToolResult(id, { success: true, message: 'Form updated successfully' });
        console.log('>>> [VapiService] Sent tool result back to VAPI');
      } catch (error) {
        console.error('>>> [VapiService] Error parsing tool call arguments:', error, 'Raw arguments:', func.arguments);
        this.sendToolResult(id, { success: false, error: 'Failed to parse arguments' });
      }
    }
    
    // Handle the save_appointment_booking tool call (final submission)
    if (func.name === 'save_appointment_booking') {
      try {
        // Handle both string and object arguments
        const bookingData: AppointmentBookingData = typeof func.arguments === 'string'
          ? JSON.parse(func.arguments)
          : func.arguments as AppointmentBookingData;
        console.log('>>> [VapiService] save_appointment_booking received:', bookingData);
        
        // Emit via the observable
        this.appointmentBookingSubject.next(bookingData);
        
        // Call all registered callbacks
        this.toolCallCallbacks.forEach(callback => callback(bookingData));
        
        // Send success result back to Vapi
        this.sendToolResult(id, { 
          success: true, 
          message: 'Appointment booking saved successfully',
          booking_id: this.generateBookingId()
        });
      } catch (error) {
        console.error('Error parsing save_appointment_booking arguments:', error);
        this.sendToolResult(id, { success: false, error: 'Failed to process booking' });
      }
    }
  }

  // Generate a simple booking ID for confirmation
  private generateBookingId(): string {
    return 'BK-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  /**
   * Register a callback to receive save_appointment_booking tool calls.
   * This is Option B: Client-side tool call handling.
   * 
   * Usage:
   *   this.vapiService.onToolCall((bookingData) => {
   *     console.log('Booking received:', bookingData);
   *     // Send to your API, display confirmation, etc.
   *   });
   */
  onToolCall(callback: (bookingData: AppointmentBookingData) => void): void {
    this.toolCallCallbacks.push(callback);
    
    // Also set up the message listener if not already done
    this.setupToolCallListener();
  }

  // Flag to prevent duplicate listener registration
  private toolCallListenerRegistered = false;

  // Set up the message listener for tool calls
  private setupToolCallListener(): void {
    if (this.toolCallListenerRegistered) return;
    this.toolCallListenerRegistered = true;

    this.vapi.on('message', (message: any) => {
      if (message.type === 'tool-calls' && message.toolCalls) {
        for (const toolCall of message.toolCalls) {
          if (toolCall.type === 'function' && toolCall.function) {
            if (toolCall.function.name === 'save_appointment_booking') {
              this.handleToolCall({
                id: toolCall.id,
                function: {
                  name: toolCall.function.name,
                  arguments: toolCall.function.arguments
                }
              });
            }
          }
        }
      }
    });
  }

  // Remove a tool call callback (for cleanup)
  removeToolCallListener(callback: (bookingData: AppointmentBookingData) => void): void {
    const index = this.toolCallCallbacks.indexOf(callback);
    if (index > -1) {
      this.toolCallCallbacks.splice(index, 1);
    }
  }

  // Filter out undefined values from an object
  private filterUndefined(obj: VoiceBookingData): VoiceBookingData {
    const filtered: VoiceBookingData = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null && value !== '') {
        (filtered as any)[key] = value;
      }
    }
    return filtered;
  }

  // Event listeners
  onCallStart(callback: () => void) {
    this.vapi.on('call-start', callback);
  }

  onCallEnd(callback: () => void) {
    this.vapi.on('call-end', callback);
  }

  onSpeechStart(callback: () => void) {
    this.vapi.on('speech-start', callback);
  }

  onSpeechEnd(callback: () => void) {
    this.vapi.on('speech-end', callback);
  }

  onTranscript(callback: (message: any) => void) {
    this.vapi.on('message', callback);
  }

  onError(callback: (error: any) => void) {
    this.vapi.on('error', callback);
  }

  // =============================================================================
  // POST-CALL REFINEMENT METHODS
  // These methods trigger server-side processing for higher accuracy extraction
  // =============================================================================

  /**
   * Trigger post-call refinement via the backend API.
   * This sends the full transcript + real-time data to Claude for thorough analysis.
   *
   * @param transcript - Optional custom transcript. If not provided, uses collected transcript.
   * @returns Promise with refined extraction results
   */
  async processPostCallRefinement(transcript?: string): Promise<RefinementResponse> {
    const fullTranscript = transcript || this.getFullTranscript();

    if (!fullTranscript || fullTranscript.trim().length < 10) {
      console.warn('>>> [VapiService] Transcript too short for refinement');
      return {
        success: false,
        error: 'Transcript is too short for refinement'
      };
    }

    console.log('>>> [VapiService] Starting post-call refinement...');
    console.log('>>> [VapiService] Transcript length:', fullTranscript.length);
    console.log('>>> [VapiService] Real-time data:', this.collectedData);
    console.log('>>> [VapiService] Real-time confidence:', this.collectedConfidence);

    try {
      const response = await this.http.post<RefinementResponse>(
        `${this.apiUrl}/api/transcription/process`,
        {
          transcript: fullTranscript,
          vapiCallId: this.currentVapiCallId,
          realtimeData: this.collectedData,
          realtimeConfidence: this.collectedConfidence,
          sourceType: 'vapi_call'
        }
      ).toPromise();

      if (response?.success && response.data) {
        console.log('>>> [VapiService] Refinement completed successfully');
        console.log('>>> [VapiService] Overall confidence:', response.data.overall_confidence);
        console.log('>>> [VapiService] Extracted data:', response.data.extracted_data);
        console.log('>>> [VapiService] Field sources:', response.data.field_sources);

        // Emit the refined data
        this.refinedDataSubject.next({
          data: response.data.extracted_data,
          confidence: response.data.confidence,
          overallConfidence: response.data.overall_confidence
        });

        // Update collected data with refined results
        this.applyRefinedData(response.data.extracted_data, response.data.confidence);
      }

      return response!;

    } catch (error: any) {
      console.error('>>> [VapiService] Post-call refinement error:', error);
      return {
        success: false,
        error: error.message || 'Refinement failed'
      };
    }
  }

  /**
   * Apply refined data to collected data, respecting user edits.
   * User-edited fields (confidence > 1.0) are never overwritten.
   */
  private applyRefinedData(
    refinedData: VoiceBookingData,
    refinedConfidence: { [key: string]: number }
  ): void {
    for (const [key, value] of Object.entries(refinedData)) {
      if (value === undefined || value === null || value === '') continue;

      const existingConfidence = this.collectedConfidence[key] || 0;
      const newConfidence = refinedConfidence[key] || 0;

      // Never overwrite user-edited fields (confidence > 1.0)
      if (existingConfidence > 1.0) {
        console.log(`>>> [VapiService] Preserving user-edited field "${key}"`);
        continue;
      }

      // Update if refined confidence is higher
      if (newConfidence > existingConfidence || !(key in this.collectedData)) {
        (this.collectedData as any)[key] = value;
        this.collectedConfidence[key] = newConfidence;
        console.log(`>>> [VapiService] Applied refined value for "${key}": "${value}" (confidence: ${newConfidence.toFixed(2)})`);
      }
    }

    // Emit updated data
    this.bookingDataSubject.next(this.collectedData);
  }

  /**
   * Mark a field as user-edited (confidence > 1.0).
   * This prevents future refinement from overwriting the value.
   */
  markFieldAsUserEdited(fieldName: keyof VoiceBookingData): void {
    this.collectedConfidence[fieldName] = 1.5;
    console.log(`>>> [VapiService] Marked "${fieldName}" as user-edited (protected from refinement)`);
  }

  /**
   * Update a field value and optionally mark it as user-edited.
   */
  updateFieldValue(
    fieldName: keyof VoiceBookingData,
    value: any,
    isUserEdit: boolean = false
  ): void {
    (this.collectedData as any)[fieldName] = value;
    this.collectedConfidence[fieldName] = isUserEdit ? 1.5 : 0.9;

    // Emit updated data
    this.bookingDataSubject.next(this.collectedData);

    console.log(`>>> [VapiService] Updated "${fieldName}" = "${value}" (userEdit: ${isUserEdit})`);
  }

  /**
   * Get low confidence fields that may need manual review.
   * @param threshold - Confidence threshold (default 0.7)
   */
  getLowConfidenceFields(threshold: number = 0.7): { field: string; confidence: number }[] {
    const lowFields: { field: string; confidence: number }[] = [];

    for (const [field, confidence] of Object.entries(this.collectedConfidence)) {
      if (confidence < threshold && confidence <= 1.0) { // Exclude user-edited fields
        lowFields.push({ field, confidence });
      }
    }

    return lowFields.sort((a, b) => a.confidence - b.confidence);
  }

  /**
   * Check if refinement is recommended based on current confidence scores.
   * @returns true if overall confidence is below threshold
   */
  shouldTriggerRefinement(threshold: number = 0.7): boolean {
    const { overallConfidence } = this.getCollectedDataWithConfidence();
    return overallConfidence < threshold;
  }

  /**
   * Merge data from an external source (e.g., OCR) with voice-collected data.
   * Uses confidence-based merging strategy.
   */
  async mergeWithExternalData(
    externalData: VoiceBookingData,
    externalConfidence: { [key: string]: number }
  ): Promise<RefinementResponse> {
    try {
      const response = await this.http.post<any>(
        `${this.apiUrl}/api/transcription/merge`,
        {
          realtimeData: this.collectedData,
          realtimeConfidence: this.collectedConfidence,
          postCallData: externalData,
          postCallConfidence: externalConfidence
        }
      ).toPromise();

      if (response?.success && response.data) {
        // Update collected data with merged results
        this.collectedData = response.data.merged_data;
        this.collectedConfidence = response.data.confidence;

        // Emit updated data
        this.bookingDataSubject.next(this.collectedData);

        return {
          success: true,
          data: {
            job_id: 'merge',
            status: 'completed',
            extracted_data: response.data.merged_data,
            confidence: response.data.confidence,
            overall_confidence: response.data.overall_confidence,
            field_sources: response.data.field_sources,
            requires_manual_review: response.data.overall_confidence < 0.5,
            processing_time: 0
          }
        };
      }

      return { success: false, error: 'Merge failed' };

    } catch (error: any) {
      console.error('>>> [VapiService] Merge error:', error);
      return { success: false, error: error.message || 'Merge failed' };
    }
  }
}
