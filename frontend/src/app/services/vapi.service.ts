// src/app/services/vapi.service.ts
import { Injectable, EventEmitter } from '@angular/core';
import { Subject } from 'rxjs';
import Vapi from '@vapi-ai/web';

// Interface for booking form data collected via voice (incremental updates)
// Field names are CANONICAL - the normalizeFieldName() method maps any Vapi field name to these
// FIELD ORDER:
// 1. test, 2. reasons, 3. preferredLocation, 4. preferredDate, 5. preferredTime,
// 6. firstName, 7. lastName, 8. dob, 9. sex, 10. addressStreet, 11. addressCity,
// 12. addressState, 13. addressZip, 14. email, 15. phone, 16. insuranceProvider, 17. insuranceId
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
  addressStreet?: string;     // 10. Street address
  addressCity?: string;       // 11. City (for address)
  addressState?: string;      // 12. State
  addressZip?: string;        // 13. ZIP code
  email?: string;             // 14. Email address
  phone?: string;             // 15. Phone number (just numbers)
  insuranceProvider?: string; // 16. Insurance company name
  insuranceId?: string;       // 17. Insurance ID / Member ID
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

  // Accumulated booking data from the conversation
  private collectedData: VoiceBookingData = {};

  // Store tool call callbacks
  private toolCallCallbacks: ((toolCall: AppointmentBookingData) => void)[] = [];

  constructor() {
    // Use your PUBLIC key (starts with pk-), not the private key
    this.vapi = new Vapi('dea287ba-8a6a-42a4-865b-1c26b932968d');
  }

  startCall() {
    // Reset collected data at the start of a new call
    this.collectedData = {};
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

  // Reset collected data
  resetCollectedData(): void {
    this.collectedData = {};
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
   * FIELD ORDER:
   * 1. test, 2. reasons, 3. preferredLocation, 4. preferredDate, 5. preferredTime,
   * 6. firstName, 7. lastName, 8. dob, 9. sex, 10. addressStreet, 11. addressCity,
   * 12. addressState, 13. addressZip, 14. email, 15. phone, 16. insuranceProvider, 17. insuranceId
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
      
      // ADDRESS fields - require explicit "address" prefix or specific field names
      'address': 'addressStreet',
      'addressstreet': 'addressStreet',
      'streetaddress': 'addressStreet',
      'street': 'addressStreet',
      
      'addresscity': 'addressCity',
      // NOTE: 'city' alone is NOT mapped here - it could be location or address
      
      'addressstate': 'addressState',
      // NOTE: 'state' alone is NOT mapped here - too ambiguous
      
      'addresszip': 'addressZip',
      'zipcode': 'addressZip',
      'zip': 'addressZip',
      'postalcode': 'addressZip',
      'postal': 'addressZip',
      
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
    
    // 10-13. ADDRESS - ONLY match if explicitly contains "address"
    if (lowerKey.includes('address')) {
      if (lowerKey.includes('street') || lowerKey === 'address') {
        return 'addressStreet';
      }
      if (lowerKey.includes('city')) {
        return 'addressCity';
      }
      if (lowerKey.includes('state')) {
        return 'addressState';
      }
      if (lowerKey.includes('zip') || lowerKey.includes('postal')) {
        return 'addressZip';
      }
    }
    
    // Street is unambiguous
    if (lowerKey.includes('street')) {
      return 'addressStreet';
    }
    
    // ZIP/postal is unambiguous
    if (lowerKey.includes('zip') || lowerKey.includes('postal')) {
      return 'addressZip';
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

        // Normalize all field names to our canonical form
        const normalizedParams: VoiceBookingData = {};
        for (const [key, value] of Object.entries(rawParams)) {
          if (value === undefined || value === null || value === '') continue;
          
          const normalizedKey = this.normalizeFieldName(key);
          if (normalizedKey) {
            (normalizedParams as any)[normalizedKey] = value;
            console.log(`>>> [VapiService] Mapped "${key}" -> "${normalizedKey}" = "${value}"`);
          }
        }

        console.log('>>> [VapiService] Normalized params:', normalizedParams);

        // Merge new data with existing collected data
        this.collectedData = {
          ...this.collectedData,
          ...normalizedParams
        };

        console.log('>>> [VapiService] Updated collectedData:', this.collectedData);
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
}