import { Component, OnInit, OnDestroy, Output, EventEmitter, ElementRef, ViewChild, AfterViewChecked, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { trigger, style, animate, transition, state } from '@angular/animations';
import { Subscription } from 'rxjs';
import { VapiService, VoiceBookingData } from '../../services/vapi.service';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface BookingFormData {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  sex?: string;
  dob?: string;
  address?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  test?: string;
  reasons?: string;
  testQuestions?: string;
  dateTime?: string;
  preferredDate?: string;
  preferredTime?: string;
  location?: string;
  preferredLocation?: string;
  company?: string;
  insurance?: string;
  insuranceProvider?: string;
  insuranceId?: string;
  email?: string;
  phone?: string;
  hasDoctorOrder?: boolean;
}

@Component({
  selector: 'app-vapi-assistant',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule
  ],
  templateUrl: './vapi-assistant.component.html',
  styleUrls: ['./vapi-assistant.component.scss'],
  animations: [
    trigger('fadeSlideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(30px)' }))
      ])
    ]),
    trigger('messageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('pulseAnimation', [
      state('active', style({ transform: 'scale(1)' })),
      state('inactive', style({ transform: 'scale(1)' })),
      transition('inactive => active', [
        animate('150ms ease-out', style({ transform: 'scale(1.1)' })),
        animate('150ms ease-in', style({ transform: 'scale(1)' }))
      ])
    ])
  ]
})
export class VapiAssistantComponent implements OnInit, OnDestroy, AfterViewChecked {
  @Output() closeAssistant = new EventEmitter<void>();
  @Output() bookingDataCollected = new EventEmitter<BookingFormData>();
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  // Call state
  isCallActive = false;
  isConnecting = false;
  isSpeaking = false;
  isListening = false;

  // Chat messages
  messages: ChatMessage[] = [];

  // Form data
  bookingForm: FormGroup;
  isEditing = false;
  formFields: { key: keyof BookingFormData; label: string; type: string }[] = [
    { key: 'test', label: 'Test', type: 'text' },
    { key: 'reasons', label: 'Reasons', type: 'text' },
    { key: 'preferredDate', label: 'Date', type: 'text' },
    { key: 'preferredTime', label: 'Time', type: 'text' },
    { key: 'preferredLocation', label: 'Location', type: 'text' },
    { key: 'firstName', label: 'First Name', type: 'text' },
    { key: 'lastName', label: 'Last Name', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'text' },
    { key: 'sex', label: 'Sex', type: 'text' },
    { key: 'addressStreet', label: 'Street', type: 'text' },
    { key: 'addressCity', label: 'City', type: 'text' },
    { key: 'addressState', label: 'State', type: 'text' },
    { key: 'addressZip', label: 'ZIP', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'insuranceProvider', label: 'Insurance', type: 'text' },
    { key: 'insuranceId', label: 'Member ID', type: 'text' }
  ];

  private shouldScrollToBottom = false;
  private currentTranscript = '';
  private bookingDataSubscription?: Subscription;

  constructor(
    private vapiService: VapiService,
    private fb: FormBuilder,
    private ngZone: NgZone
  ) {
    this.bookingForm = this.fb.group({
      test: [''],
      reasons: [''],
      preferredDate: [''],
      preferredTime: [''],
      preferredLocation: [''],
      firstName: [''],
      lastName: [''],
      dob: [''],
      sex: [''],
      addressStreet: [''],
      addressCity: [''],
      addressState: [''],
      addressZip: [''],
      email: [''],
      phone: [''],
      insuranceProvider: [''],
      insuranceId: [''],
      hasDoctorOrder: [null]
    });
  }

  ngOnInit(): void {
    this.setupVapiListeners();
    this.subscribeToBookingData();
    this.addSystemMessage('Click "Start Call" to begin speaking with the assistant about booking your medical test.');
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    if (this.isCallActive) {
      this.vapiService.endCall();
    }
    this.bookingDataSubscription?.unsubscribe();
  }

  private subscribeToBookingData(): void {
    // Subscribe to booking data updates from VapiService
    this.bookingDataSubscription = this.vapiService.bookingData$.subscribe(
      (data: VoiceBookingData) => {
        this.ngZone.run(() => {
          console.log('Received booking data from VapiService:', data);
          this.updateFormFromVoiceData(data);
        });
      }
    );
  }

  private updateFormFromVoiceData(data: VoiceBookingData): void {
    // Map VoiceBookingData to form fields
    const formUpdate: Partial<BookingFormData> = {};

    if (data.test) formUpdate.test = data.test;
    if (data.reasons) formUpdate.reasons = data.reasons;
    if (data.preferredDate) formUpdate.preferredDate = data.preferredDate;
    if (data.preferredTime) formUpdate.preferredTime = data.preferredTime;
    if (data.preferredLocation) formUpdate.preferredLocation = data.preferredLocation;
    if (data.firstName) formUpdate.firstName = data.firstName;
    if (data.lastName) formUpdate.lastName = data.lastName;
    if (data.dob) formUpdate.dob = data.dob;
    if (data.sex) formUpdate.sex = data.sex;
    if (data.addressStreet) formUpdate.addressStreet = data.addressStreet;
    if (data.addressCity) formUpdate.addressCity = data.addressCity;
    if (data.addressState) formUpdate.addressState = data.addressState;
    if (data.addressZip) formUpdate.addressZip = data.addressZip;
    if (data.email) formUpdate.email = data.email;
    if (data.phone) formUpdate.phone = data.phone;
    if (data.insuranceProvider) formUpdate.insuranceProvider = data.insuranceProvider;
    if (data.insuranceId) formUpdate.insuranceId = data.insuranceId;

    this.bookingForm.patchValue(formUpdate);
    console.log('Form updated with voice data:', formUpdate);
  }

  private setupVapiListeners(): void {
    // VAPI events fire outside Angular's zone, so we need to wrap callbacks
    // in ngZone.run() to trigger change detection and update the UI

    this.vapiService.onCallStart(() => {
      this.ngZone.run(() => {
        console.log('Call started');
        this.isCallActive = true;
        this.isConnecting = false;
        this.isListening = true;
        this.addSystemMessage('Connected! You can now speak with the assistant.');
      });
    });

    this.vapiService.onCallEnd(() => {
      this.ngZone.run(() => {
        console.log('Call ended');
        this.isCallActive = false;
        this.isConnecting = false;
        this.isSpeaking = false;
        this.isListening = false;
        this.addSystemMessage('Call ended.');
      });
    });

    this.vapiService.onSpeechStart(() => {
      this.ngZone.run(() => {
        this.isSpeaking = true;
        this.isListening = false;
      });
    });

    this.vapiService.onSpeechEnd(() => {
      this.ngZone.run(() => {
        this.isSpeaking = false;
        this.isListening = true;
      });
    });

    this.vapiService.onTranscript((message) => {
      this.ngZone.run(() => {
        this.handleTranscript(message);
      });
    });

    this.vapiService.onError((error) => {
      this.ngZone.run(() => {
        console.error('Vapi error:', error);
        this.isConnecting = false;
        this.addSystemMessage('An error occurred. Please try again.');
      });
    });
  }

  private handleTranscript(message: any): void {
    console.log('VAPI Message received:', JSON.stringify(message, null, 2));

    // Handle different message types from VAPI
    if (message.type === 'transcript') {
      const role = message.role === 'user' ? 'user' : 'assistant';

      if (message.transcriptType === 'final') {
        this.addMessage(role, message.transcript);
        this.currentTranscript = '';

        // ONLY extract form data from USER messages - never from agent/assistant speech
        if (role === 'user') {
          this.extractFormData(message.transcript, role);
        }
      }
    } else if (message.type === 'tool-calls') {
      // Handle tool calls from VAPI assistant (new format)
      // Tool calls contain user data processed by the assistant
      this.handleToolCalls(message);
    } else if (message.type === 'function-call') {
      // Handle function calls from VAPI assistant (legacy format)
      this.handleFunctionCall(message);
    } else if (message.type === 'conversation-update') {
      // Handle conversation updates - only process user messages
      if (message.conversation) {
        this.processConversationUpdate(message.conversation);
      }
    }
  }

  private handleToolCalls(message: any): void {
    console.log('VAPI Tool Calls received:', JSON.stringify(message, null, 2));

    if (message.toolCalls && Array.isArray(message.toolCalls)) {
      for (const toolCall of message.toolCalls) {
        if (toolCall.type === 'function' && toolCall.function) {
          const { name, arguments: args } = toolCall.function;
          
          if (name === 'update_booking_form' || name === 'updateBookingForm') {
            console.log('Processing update_booking_form tool call:', { id: toolCall.id, args });
            
            // Let VapiService handle the tool call (it will emit via bookingData$)
            this.vapiService.handleToolCall({
              id: toolCall.id,
              function: {
                name: name,
                arguments: args
              }
            });
          }
        }
      }
    }
  }

  private handleFunctionCall(message: any): void {
    console.log('VAPI Function Call received:', JSON.stringify(message, null, 2));

    // Handle various function call formats from VAPI (legacy format)
    const functionCall = message.functionCall || message.function_call || message;
    const functionName = functionCall?.name || functionCall?.function?.name;
    const params = functionCall?.parameters || functionCall?.arguments || functionCall?.function?.arguments;

    console.log('Parsed function call:', { functionName, params });

    if (functionName === 'updateBookingForm' || functionName === 'update_booking_form') {
      const parsedParams = typeof params === 'string' ? JSON.parse(params) : params;
      if (parsedParams) {
        this.updateFormFromParams(parsedParams);
      }
    }
  }

  private processConversationUpdate(conversation: any[]): void {
    // Process the full conversation for any structured data
    // ONLY extract data from USER messages - never from agent/assistant
    console.log('Processing conversation update:', conversation);
    conversation.forEach((msg: any) => {
      if (msg.content && msg.role === 'user') {
        this.extractFormData(msg.content, 'user');
      }
    });
  }

  private extractFormData(text: string, role: 'user' | 'assistant' = 'user'): void {
    // RESTRICTION: Only process USER messages - never extract from agent/assistant speech
    // This is a fallback extraction method for when tool calls are not used.
    // The primary method of data extraction is via Vapi tool calls.
    if (role !== 'user') {
      console.log('[Fallback] Skipping extraction - not a user message');
      return;
    }

    const lowerText = text.toLowerCase().trim();
    console.log('[Fallback] Extracting from USER message:', text);

    // Extract test type from user speech
    const testTypes = [
      'Complete Blood Count', 'CBC', 'Lipid Panel', 'Thyroid Panel', 'TSH',
      'Hemoglobin A1C', 'Vitamin D', 'MRI', 'CT Scan', 'X-Ray', 'ECG', 'EKG',
      'Blood Test', 'Ultrasound', 'Mammogram', 'Colonoscopy'
    ];
    for (const testType of testTypes) {
      if (lowerText.includes(testType.toLowerCase())) {
        this.bookingForm.patchValue({ test: testType });
        console.log('Extracted test:', testType);
        break;
      }
    }

    // DIRECT USER RESPONSE PATTERNS (when user just says the value without context)
    // Direct name response: "John Smith" (split into first/last)
    const directNameMatch = text.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/);
    if (directNameMatch && !this.bookingForm.get('firstName')?.value) {
      this.bookingForm.patchValue({ 
        firstName: directNameMatch[1].trim(),
        lastName: directNameMatch[2].trim()
      });
      console.log('Extracted direct name:', directNameMatch[1], directNameMatch[2]);
    }

    // Direct sex response: "Male" or "Female"
    if (/^(male|female|man|woman)$/i.test(lowerText)) {
      const normalizedSex = lowerText.includes('male') || lowerText.includes('man') ? 'M' : 'F';
      this.bookingForm.patchValue({ sex: normalizedSex });
      console.log('Extracted direct sex:', normalizedSex);
    }

    // Direct date response: "January 15, 1990" or "01/15/1990" or "1/15/90"
    const directDateMatch = text.match(/^(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})$/);
    if (directDateMatch && !this.bookingForm.get('dob')?.value) {
      this.bookingForm.patchValue({ dob: directDateMatch[1].trim() });
      console.log('Extracted direct date:', directDateMatch[1]);
    }

    // Direct insurance ID: alphanumeric string like "ABC123456"
    const directInsuranceIdMatch = text.match(/^([A-Z]{2,4}[0-9]{6,12}|[0-9]{9,12})$/i);
    if (directInsuranceIdMatch && !this.bookingForm.get('insuranceId')?.value) {
      this.bookingForm.patchValue({ insuranceId: directInsuranceIdMatch[1].toUpperCase() });
      console.log('Extracted direct insurance ID:', directInsuranceIdMatch[1]);
    }

    // Extract email from user speech
    const emailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
    if (emailMatch && !this.bookingForm.get('email')?.value) {
      this.bookingForm.patchValue({ email: emailMatch[1].toLowerCase() });
      console.log('Extracted email:', emailMatch[1]);
    }

    // Extract phone number from user speech
    const phoneMatch = text.match(/\b(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/);
    if (phoneMatch && !this.bookingForm.get('phone')?.value) {
      this.bookingForm.patchValue({ phone: phoneMatch[1] });
      console.log('Extracted phone:', phoneMatch[1]);
    }

    // CONTEXTUAL PATTERNS (with phrases like "my name is", "I live at", etc.)
    // Extract name patterns and split into first/last
    const nameMatch = text.match(/(?:name is|I'm|I am|patient name is|my name is|it's|this is)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch && !this.bookingForm.get('firstName')?.value) {
      this.bookingForm.patchValue({ 
        firstName: nameMatch[1].trim(),
        lastName: nameMatch[2].trim()
      });
      console.log('Extracted contextual name:', nameMatch[1], nameMatch[2]);
    }

    // Extract sex/gender (normalize to M/F)
    const sexMatch = text.match(/(?:sex is|gender is|I am a|I'm a|I am|I'm)\s+(male|female|man|woman)/i);
    if (sexMatch) {
      const sexValue = sexMatch[1].toLowerCase();
      const normalizedSex = (sexValue === 'male' || sexValue === 'man') ? 'M' : 'F';
      this.bookingForm.patchValue({ sex: normalizedSex });
      console.log('Extracted contextual sex:', normalizedSex);
    }

    // Extract date of birth
    const dobMatch = text.match(/(?:date of birth|birthday|born on|dob is|born|birthday is)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (dobMatch && !this.bookingForm.get('dob')?.value) {
      this.bookingForm.patchValue({ dob: dobMatch[1].trim() });
      console.log('Extracted contextual DOB:', dobMatch[1]);
    }

    // Extract reasons for test
    const reasonsMatch = text.match(/(?:reason is|because|for|due to|because of|reason for)\s+([^.]+)/i);
    if (reasonsMatch && !this.bookingForm.get('reasons')?.value) {
      this.bookingForm.patchValue({ reasons: reasonsMatch[1].trim() });
      console.log('Extracted reasons:', reasonsMatch[1]);
    }

    // Extract insurance info - common insurance providers
    const insuranceProviders = [
      'Blue Cross', 'Blue Shield', 'Aetna', 'Cigna', 'United Healthcare', 'UnitedHealthcare',
      'Humana', 'Kaiser', 'Anthem', 'Medicare', 'Medicaid', 'Oscar', 'Molina'
    ];
    for (const provider of insuranceProviders) {
      if (lowerText.includes(provider.toLowerCase())) {
        this.bookingForm.patchValue({ insuranceProvider: provider });
        console.log('Extracted insurance provider:', provider);
        break;
      }
    }

    // Extract insurance ID
    const insuranceIdMatch = text.match(/(?:insurance id is|member id is|policy number is|id number is|id is|number is)\s+([A-Z0-9]+)/i);
    if (insuranceIdMatch && !this.bookingForm.get('insuranceId')?.value) {
      this.bookingForm.patchValue({ insuranceId: insuranceIdMatch[1].trim() });
      console.log('Extracted insurance ID:', insuranceIdMatch[1]);
    }
  }

  private updateFormFromParams(params: any): void {
    console.log('Updating form with params:', params);

    const fieldMapping: Record<string, keyof BookingFormData> = {
      // Name fields - now separate firstName/lastName
      first_name: 'firstName',
      firstName: 'firstName',
      last_name: 'lastName',
      lastName: 'lastName',

      // Sex variations
      sex: 'sex',
      gender: 'sex',

      // DOB variations
      date_of_birth: 'dob',
      dob: 'dob',
      birthday: 'dob',
      birth_date: 'dob',
      dateOfBirth: 'dob',

      // Address variations - now separate fields
      address: 'addressStreet',
      street_address: 'addressStreet',
      addressStreet: 'addressStreet',
      streetAddress: 'addressStreet',
      city: 'addressCity',
      addressCity: 'addressCity',
      state: 'addressState',
      addressState: 'addressState',
      zip: 'addressZip',
      zipCode: 'addressZip',
      zip_code: 'addressZip',
      addressZip: 'addressZip',

      // Test variations
      test: 'test',
      test_type: 'test',
      test_name: 'test',
      testType: 'test',

      // Reasons variations
      reasons: 'reasons',
      reason: 'reasons',
      reason_for_test: 'reasons',
      reasonForTest: 'reasons',

      // Date/Time variations - now separate fields
      preferred_date: 'preferredDate',
      preferredDate: 'preferredDate',
      appointment_date: 'preferredDate',
      appointmentDate: 'preferredDate',
      preferred_time: 'preferredTime',
      preferredTime: 'preferredTime',
      appointment_time: 'preferredTime',
      appointmentTime: 'preferredTime',

      // Location variations
      location: 'preferredLocation',
      preferred_location: 'preferredLocation',
      preferredLocation: 'preferredLocation',
      clinic_location: 'preferredLocation',
      clinicLocation: 'preferredLocation',

      // Email
      email: 'email',
      email_address: 'email',
      emailAddress: 'email',

      // Phone
      phone: 'phone',
      phone_number: 'phone',
      phoneNumber: 'phone',

      // Insurance variations
      insurance: 'insuranceProvider',
      insurance_provider: 'insuranceProvider',
      insurance_carrier: 'insuranceProvider',
      insurance_company: 'insuranceProvider',
      insuranceProvider: 'insuranceProvider',
      insuranceCarrier: 'insuranceProvider',

      // Insurance ID variations
      insurance_id: 'insuranceId',
      insuranceId: 'insuranceId',
      member_id: 'insuranceId',
      memberId: 'insuranceId',
      policy_number: 'insuranceId',
      policyNumber: 'insuranceId',

      // Doctor's order
      has_doctor_order: 'hasDoctorOrder',
      hasDoctorOrder: 'hasDoctorOrder',
      doctor_order: 'hasDoctorOrder',
      doctorOrder: 'hasDoctorOrder'
    };

    Object.entries(params).forEach(([key, value]) => {
      const formKey = fieldMapping[key] || key;
      if (this.bookingForm.contains(formKey as string) && value !== undefined && value !== null) {
        this.bookingForm.patchValue({ [formKey]: value });
        console.log(`Set ${formKey} to:`, value);
      }
    });
  }

  private addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    this.messages.push({
      role,
      content,
      timestamp: new Date()
    });
    this.shouldScrollToBottom = true;
  }

  private addSystemMessage(content: string): void {
    this.addMessage('system', content);
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer?.nativeElement) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }

  async toggleCall(): Promise<void> {
    if (this.isCallActive) {
      this.vapiService.endCall();
    } else {
      this.isConnecting = true;
      this.addSystemMessage('Connecting to assistant...');
      try {
        await this.vapiService.startCall();
      } catch (error) {
        console.error('Failed to start call:', error);
        this.isConnecting = false;
        this.addSystemMessage('Failed to connect. Please try again.');
      }
    }
  }

  get callButtonText(): string {
    if (this.isConnecting) return 'Connecting...';
    return this.isCallActive ? 'End Call' : 'Start Call';
  }

  get statusText(): string {
    if (this.isConnecting) return 'Connecting...';
    if (!this.isCallActive) return 'Ready to call';
    if (this.isSpeaking) return 'Assistant is speaking...';
    if (this.isListening) return 'Listening...';
    return 'Connected';
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
  }

  saveChanges(): void {
    this.isEditing = false;
  }

  onClose(): void {
    if (this.isCallActive) {
      this.vapiService.endCall();
    }
    
    // Emit collected booking data when closing (if any data was collected)
    if (this.hasFormData()) {
      this.emitBookingData();
    }
    
    this.closeAssistant.emit();
  }

  hasFormData(): boolean {
    const values = this.bookingForm.value as Record<string, any>;
    return Object.values(values).some(v => v !== null && v !== undefined && String(v).trim() !== '');
  }

  getFilledFields(): { key: string; label: string; value: string }[] {
    const values = this.bookingForm.value as Record<string, any>;
    return this.formFields
      .filter(f => values[f.key] !== null && values[f.key] !== undefined && String(values[f.key]).trim() !== '')
      .map(f => ({
        key: f.key,
        label: f.label,
        value: String(values[f.key])
      }));
  }

  getFormControl(key: string): FormControl {
    return this.bookingForm.get(key) as FormControl;
  }

  private emitBookingData(): void {
    const formData = this.bookingForm.value as BookingFormData;
    
    // Clean up the data - remove empty values
    const cleanedData: BookingFormData = {};
    for (const [key, value] of Object.entries(formData)) {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        (cleanedData as any)[key] = value;
      }
    }
    
    console.log('Emitting booking data:', cleanedData);
    this.bookingDataCollected.emit(cleanedData);
  }

  proceedToBooking(): void {
    // Emit the collected data and close the assistant
    this.emitBookingData();
    
    if (this.isCallActive) {
      this.vapiService.endCall();
    }
    
    this.closeAssistant.emit();
  }

  // Get collected data from both form and service
  getCollectedData(): BookingFormData {
    return {
      ...this.bookingForm.value,
      ...this.vapiService.getCollectedData()
    };
  }
}
