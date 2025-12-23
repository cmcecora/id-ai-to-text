import { Component, OnInit, OnDestroy, Output, EventEmitter, ElementRef, ViewChild, AfterViewChecked, NgZone, ChangeDetectorRef } from '@angular/core';
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
  isPaused = false;

  // Connection timeout
  private connectionTimeout?: ReturnType<typeof setTimeout>;

  // Chat messages
  messages: ChatMessage[] = [];
  userResponses: ChatMessage[] = [];

  // Form data
  bookingForm: FormGroup;
  isEditing = false;
  // Form fields in EXACT collection order:
  // 1. Test, 2. Reasons, 3. Location, 4. Date, 5. Time, 6. First Name, 7. Last Name,
  // 8. DOB, 9. Sex, 10. Address (raw), 11. Email, 12. Phone,
  // 13. Insurance Provider, 14. Insurance ID
  formFields: { key: keyof BookingFormData; label: string; type: string }[] = [
    { key: 'test', label: 'Test', type: 'text' },                    // 1
    { key: 'reasons', label: 'Reasons', type: 'text' },              // 2
    { key: 'preferredLocation', label: 'Location', type: 'text' },   // 3
    { key: 'preferredDate', label: 'Date', type: 'text' },           // 4
    { key: 'preferredTime', label: 'Time', type: 'text' },           // 5
    { key: 'firstName', label: 'First Name', type: 'text' },         // 6
    { key: 'lastName', label: 'Last Name', type: 'text' },           // 7
    { key: 'dob', label: 'DOB', type: 'text' },                      // 8
    { key: 'sex', label: 'Sex', type: 'text' },                      // 9
    { key: 'address', label: 'Address', type: 'text' },              // 10 (raw)
    { key: 'email', label: 'Email', type: 'text' },                  // 11
    { key: 'phone', label: 'Phone', type: 'text' },                  // 12
    { key: 'insuranceProvider', label: 'Insurance', type: 'text' },  // 13
    { key: 'insuranceId', label: 'Member ID', type: 'text' }         // 14
  ];

  private shouldScrollToBottom = false;
  private currentTranscript = '';
  private bookingDataSubscription?: Subscription;

  constructor(
    private vapiService: VapiService,
    private fb: FormBuilder,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
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
      address: [''],
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
    this.clearConnectionTimeout();
    if (this.isCallActive || this.isConnecting) {
      this.vapiService.endCall();
    }
    this.bookingDataSubscription?.unsubscribe();
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = undefined;
    }
  }

  private subscribeToBookingData(): void {
    console.log('>>> [VapiAssistant] Setting up bookingData$ subscription');
    // Subscribe to booking data updates from VapiService
    this.bookingDataSubscription = this.vapiService.bookingData$.subscribe(
      (data: VoiceBookingData) => {
        console.log('>>> [VapiAssistant] SUBSCRIPTION RECEIVED data:', data);
        this.ngZone.run(() => {
          console.log('>>> [VapiAssistant] Inside ngZone.run(), calling updateFormFromVoiceData');
          this.updateFormFromVoiceData(data);
          this.triggerViewUpdate();
        });
      }
    );
    console.log('>>> [VapiAssistant] bookingData$ subscription created');
  }

  private updateFormFromVoiceData(data: VoiceBookingData): void {
    console.log('>>> [VapiAssistant] updateFormFromVoiceData called with:', data);

    // VapiService now normalizes field names before sending, so we can map directly.
    // FIELD ORDER (one raw answer per question):
    // 1. Test, 2. Reasons, 3. Location, 4. Date, 5. Time, 6. First Name, 7. Last Name,
    // 8. DOB, 9. Sex, 10. Address (raw), 11. Email, 12. Phone, 13. Insurance Provider, 14. Insurance ID
    
    const formUpdate: Partial<BookingFormData> = {};

    // 1. TEST (first field) - what test does the user want?
    if (data.test) {
      const normalizedTest = this.findMedicalTest(data.test) || this.normalizeTestName(data.test);
      formUpdate.test = normalizedTest;
      console.log(`>>> [VapiAssistant] [1] Test: "${data.test}" -> "${normalizedTest}"`);
    }

    // 2. REASONS (second field) - why do they need this test?
    if (data.reasons) {
      formUpdate.reasons = data.reasons;
      console.log(`>>> [VapiAssistant] [2] Reasons: "${data.reasons}"`);
    }

    // 3. LOCATION (third field) - where? city, state or zipcode
    if (data.preferredLocation) {
      formUpdate.preferredLocation = data.preferredLocation;
      console.log(`>>> [VapiAssistant] [3] Location: "${data.preferredLocation}"`);
    }

    // 4. DATE (fourth field) - when? words or numbers
    if (data.preferredDate) {
      formUpdate.preferredDate = data.preferredDate;
      console.log(`>>> [VapiAssistant] [4] Date: "${data.preferredDate}"`);
    }

    // 5. TIME (fifth field) - what time? words or numbers
    if (data.preferredTime) {
      formUpdate.preferredTime = data.preferredTime;
      console.log(`>>> [VapiAssistant] [5] Time: "${data.preferredTime}"`);
    }

    // 6. FIRST NAME (sixth field)
    if (data.firstName) {
      formUpdate.firstName = data.firstName;
      console.log(`>>> [VapiAssistant] [6] First Name: "${data.firstName}"`);
    }

    // 7. LAST NAME (seventh field)
    if (data.lastName) {
      formUpdate.lastName = data.lastName;
      console.log(`>>> [VapiAssistant] [7] Last Name: "${data.lastName}"`);
    }

    // 8. DATE OF BIRTH (eighth field) - words or numbers
    if (data.dob) {
      formUpdate.dob = data.dob;
      console.log(`>>> [VapiAssistant] [8] DOB: "${data.dob}"`);
    }

    // 9. SEX (ninth field) - male or female
    if (data.sex) {
      // Normalize to Male/Female
      const lowerSex = data.sex.toLowerCase().trim();
      const normalizedSex = (lowerSex === 'male' || lowerSex === 'm' || lowerSex === 'man') ? 'Male' :
                           (lowerSex === 'female' || lowerSex === 'f' || lowerSex === 'woman') ? 'Female' : data.sex;
      formUpdate.sex = normalizedSex;
      console.log(`>>> [VapiAssistant] [9] Sex: "${data.sex}" -> "${normalizedSex}"`);
    }

    // 10. ADDRESS (tenth field) - keep full raw answer; split later in cleanup
    if (data.address) {
      formUpdate.address = data.address;
      console.log(`>>> [VapiAssistant] [10] Address (raw): "${data.address}"`);
    }

    // 11. EMAIL (eleventh field)
    if (data.email) {
      formUpdate.email = data.email.toLowerCase();
      console.log(`>>> [VapiAssistant] [11] Email: "${data.email}"`);
    }

    // 12. PHONE (twelfth field) - just numbers
    if (data.phone) {
      formUpdate.phone = data.phone;
      console.log(`>>> [VapiAssistant] [12] Phone: "${data.phone}"`);
    }

    // 13. INSURANCE PROVIDER (thirteenth field)
    if (data.insuranceProvider) {
      formUpdate.insuranceProvider = data.insuranceProvider;
      console.log(`>>> [VapiAssistant] [13] Insurance: "${data.insuranceProvider}"`);
    }

    // 14. INSURANCE ID (fourteenth field)
    if (data.insuranceId) {
      formUpdate.insuranceId = data.insuranceId;
      console.log(`>>> [VapiAssistant] [14] Insurance ID: "${data.insuranceId}"`);
    }

    console.log('>>> [VapiAssistant] Final formUpdate:', formUpdate);
    this.bookingForm.patchValue(formUpdate);
    console.log('>>> [VapiAssistant] Form patched. Current form value:', this.bookingForm.value);
  }

  private setupVapiListeners(): void {
    // VAPI events fire outside Angular's zone, so we need to wrap callbacks
    // in ngZone.run() to trigger change detection and update the UI

    this.vapiService.onCallStart(() => {
      this.ngZone.run(() => {
        console.log('Call started');
        this.clearConnectionTimeout();
        this.isCallActive = true;
        this.isConnecting = false;
        this.isListening = true;
        this.addSystemMessage('Connected! You can now speak with the assistant.');
        this.triggerViewUpdate();
      });
    });

    this.vapiService.onCallEnd(() => {
      this.ngZone.run(() => {
        console.log('Call ended (event)');
        this.clearConnectionTimeout();
        // Only add message if we were actually in an active call
        const wasActive = this.isCallActive;
        this.isCallActive = false;
        this.isConnecting = false;
        this.isSpeaking = false;
        this.isListening = false;
        this.isPaused = false;

        // Try to extract any missing data from the last assistant message (summary)
        if (wasActive) {
          this.tryExtractFromLastMessages();
        }
        this.triggerViewUpdate();
      });
    });

    this.vapiService.onSpeechStart(() => {
      this.ngZone.run(() => {
        this.isSpeaking = true;
        this.isListening = false;
        this.triggerViewUpdate();
      });
    });

    this.vapiService.onSpeechEnd(() => {
      this.ngZone.run(() => {
        this.isSpeaking = false;
        this.isListening = true;
        this.triggerViewUpdate();
      });
    });

    this.vapiService.onTranscript((message) => {
      this.ngZone.run(() => {
        this.handleTranscript(message);
        this.triggerViewUpdate();
      });
    });

    this.vapiService.onError((error) => {
      this.ngZone.run(() => {
        console.error('Vapi error:', error);
        this.isConnecting = false;
        this.addSystemMessage('An error occurred. Please try again.');
        this.triggerViewUpdate();
      });
    });
  }

  private handleTranscript(message: any): void {
    console.log('>>> [VapiAssistant] VAPI Message received - type:', message.type);
    console.log('>>> [VapiAssistant] Full message:', JSON.stringify(message, null, 2));

    // Handle different message types from VAPI
    if (message.type === 'transcript') {
      console.log('>>> [VapiAssistant] Processing TRANSCRIPT message');
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
      console.log('>>> [VapiAssistant] Processing TOOL-CALLS message');
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
    console.log('>>> [VapiAssistant] handleToolCalls received message:', JSON.stringify(message, null, 2));

    if (message.toolCalls && Array.isArray(message.toolCalls)) {
      console.log('>>> [VapiAssistant] Found', message.toolCalls.length, 'tool calls');

      for (const toolCall of message.toolCalls) {
        console.log('>>> [VapiAssistant] Processing toolCall:', { type: toolCall.type, function: toolCall.function });

        if (toolCall.type === 'function' && toolCall.function) {
          const { name, arguments: args } = toolCall.function;

          console.log('>>> [VapiAssistant] Tool function name:', name, 'Arguments:', args, 'Type:', typeof args);

          if (name === 'update_booking_form' || name === 'updateBookingForm') {
            console.log('>>> [VapiAssistant] Delegating to VapiService.handleToolCall');

            // Let VapiService handle the tool call (it will emit via bookingData$)
            this.vapiService.handleToolCall({
              id: toolCall.id,
              function: {
                name: name,
                arguments: args
              }
            });

            console.log('>>> [VapiAssistant] VapiService.handleToolCall completed');
          } else {
            console.log('>>> [VapiAssistant] Ignoring tool call with name:', name);
          }
        }
      }
    } else {
      console.log('>>> [VapiAssistant] No toolCalls array found in message');
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

  // Comprehensive medical test database with variations and abbreviations
  private readonly medicalTests: { name: string; variations: string[] }[] = [
    // Blood Tests
    { name: 'Complete Blood Count (CBC)', variations: ['cbc', 'complete blood count', 'blood count', 'full blood count'] },
    { name: 'Basic Metabolic Panel (BMP)', variations: ['bmp', 'basic metabolic panel', 'metabolic panel', 'chem 7', 'chem7'] },
    { name: 'Comprehensive Metabolic Panel (CMP)', variations: ['cmp', 'comprehensive metabolic panel', 'chem 14', 'chem14'] },
    { name: 'Lipid Panel', variations: ['lipid panel', 'lipid profile', 'cholesterol test', 'cholesterol panel', 'lipids'] },
    { name: 'Hemoglobin A1C', variations: ['a1c', 'hba1c', 'hemoglobin a1c', 'glycated hemoglobin', 'diabetes test'] },
    { name: 'Thyroid Panel', variations: ['thyroid panel', 'thyroid test', 'thyroid function', 'tsh', 't3', 't4', 'thyroid'] },
    { name: 'TSH', variations: ['tsh', 'thyroid stimulating hormone'] },
    { name: 'Liver Function Test (LFT)', variations: ['lft', 'liver function', 'liver panel', 'liver test', 'hepatic panel'] },
    { name: 'Kidney Function Test', variations: ['kidney function', 'renal function', 'kidney panel', 'renal panel', 'bun', 'creatinine'] },
    { name: 'Vitamin D Test', variations: ['vitamin d', 'vit d', '25-hydroxy', 'vitamin d test'] },
    { name: 'Vitamin B12 Test', variations: ['vitamin b12', 'b12', 'cobalamin'] },
    { name: 'Iron Panel', variations: ['iron panel', 'iron test', 'ferritin', 'iron studies', 'serum iron'] },
    { name: 'Blood Glucose Test', variations: ['blood glucose', 'blood sugar', 'fasting glucose', 'glucose test'] },
    { name: 'Prothrombin Time (PT/INR)', variations: ['pt', 'inr', 'prothrombin', 'coagulation test', 'clotting test'] },
    { name: 'PSA Test', variations: ['psa', 'prostate specific antigen', 'prostate test'] },
    { name: 'Urinalysis', variations: ['urinalysis', 'urine test', 'urine analysis', 'ua'] },

    // Imaging Tests
    { name: 'MRI', variations: ['mri', 'magnetic resonance', 'magnetic resonance imaging'] },
    { name: 'CT Scan', variations: ['ct scan', 'ct', 'cat scan', 'computed tomography'] },
    { name: 'X-Ray', variations: ['x-ray', 'xray', 'x ray', 'radiograph'] },
    { name: 'Ultrasound', variations: ['ultrasound', 'sonogram', 'sonography', 'echo'] },
    { name: 'Mammogram', variations: ['mammogram', 'mammography', 'breast imaging', 'breast scan'] },
    { name: 'DEXA Scan', variations: ['dexa', 'dxa', 'bone density', 'bone density scan', 'bone scan'] },
    { name: 'PET Scan', variations: ['pet scan', 'pet', 'positron emission'] },
    { name: 'Echocardiogram', variations: ['echocardiogram', 'echo', 'heart ultrasound', 'cardiac echo'] },

    // Cardiac Tests
    { name: 'ECG/EKG', variations: ['ecg', 'ekg', 'electrocardiogram', 'heart rhythm test'] },
    { name: 'Stress Test', variations: ['stress test', 'treadmill test', 'exercise test', 'cardiac stress'] },
    { name: 'Holter Monitor', variations: ['holter', 'holter monitor', '24 hour heart monitor'] },

    // Procedures/Screenings
    { name: 'Colonoscopy', variations: ['colonoscopy', 'colon screening', 'colon exam'] },
    { name: 'Endoscopy', variations: ['endoscopy', 'upper endoscopy', 'egd', 'upper gi'] },
    { name: 'Biopsy', variations: ['biopsy', 'tissue sample'] },
    { name: 'Pap Smear', variations: ['pap smear', 'pap test', 'cervical screening', 'pap'] },

    // Allergy/Immunology
    { name: 'Allergy Test', variations: ['allergy test', 'allergy panel', 'allergen test', 'skin prick test'] },
    { name: 'COVID-19 Test', variations: ['covid test', 'covid-19', 'coronavirus test', 'pcr test', 'covid'] },

    // STI Tests
    { name: 'STI Panel', variations: ['sti test', 'sti panel', 'std test', 'std panel', 'sexually transmitted'] },
    { name: 'HIV Test', variations: ['hiv test', 'hiv', 'aids test'] },

    // Genetic/Specialty
    { name: 'Genetic Testing', variations: ['genetic test', 'dna test', 'genetic screening', 'genetics'] },
    { name: 'Sleep Study', variations: ['sleep study', 'polysomnography', 'sleep test', 'sleep apnea test'] },
    { name: 'Pulmonary Function Test', variations: ['pulmonary function', 'pft', 'lung function', 'spirometry', 'breathing test'] },

    // General
    { name: 'Blood Test', variations: ['blood test', 'blood work', 'bloodwork', 'lab work', 'labs'] },
    { name: 'Physical Exam', variations: ['physical exam', 'physical', 'annual physical', 'checkup', 'check up'] }
  ];

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

    // 1. Extract medical test using comprehensive matching
    const extractedTest = this.extractMedicalTest(text);
    if (extractedTest) {
      this.bookingForm.patchValue({ test: extractedTest });
      console.log('[Extraction] Test:', extractedTest);
    }

    // 2. Extract REASONS for the test
    const reasonsPatterns = [
      /(?:reason is|because|for|due to|because of|reason for|getting it for|need it for|want it for|it's for)\s+([^.!?]+)/i,
      /(?:my doctor|physician|provider)\s+(?:told me|said|recommended|ordered|wants me)\s+(?:to get|I need)?\s*([^.!?]+)/i,
      /(?:I have|I've been having|experiencing|suffering from|dealing with)\s+([^.!?]+)/i,
      /(?:checkup|check-up|annual|routine|regular)\s*(?:exam|examination|physical)?/i,
      /(?:screening|preventive|prevention)/i
    ];
    for (const pattern of reasonsPatterns) {
      const match = text.match(pattern);
      if (match && !this.bookingForm.get('reasons')?.value) {
        const reason = match[1] ? match[1].trim() : match[0].trim();
        this.bookingForm.patchValue({ reasons: reason });
        console.log('[Extraction] Reasons:', reason);
        break;
      }
    }

    // 3. Extract LOCATION preference - only match actual location contexts
    const locationPatterns = [
      // NYC neighborhoods and boroughs
      /\b(downtown|midtown|uptown|westside|eastside|chelsea|soho|tribeca|brooklyn|manhattan|queens|bronx|staten island|harlem|greenwich)\b/i,
      // Explicit location mentions with required context
      /(?:location|clinic|center|office|facility)\s+(?:on|at|near|in)\s+([^.!?,]+)/i,
      /(?:prefer|want|like)\s+(?:the\s+)?(?:location|clinic|center|office)\s+(?:on|at|near|in)\s+([^.!?,]+)/i,
      /(?:closest|nearest|nearby)\s+(?:location|clinic|center|office)(?:\s+to\s+me)?/i,
      // Zip code pattern
      /(?:zip\s*(?:code)?|area)\s+(\d{5})/i,
      // Near/in city pattern (requires explicit city context)
      /(?:tested|appointment|visit)\s+(?:in|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
    ];
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match && !this.bookingForm.get('preferredLocation')?.value) {
        const location = match[1] ? match[1].trim() : match[0].trim();
        // Filter out common false positives
        const falsePositives = ['to get', 'to take', 'to do', 'to have', 'to schedule', 'to book', 'get', 'take', 'have'];
        if (!falsePositives.includes(location.toLowerCase())) {
          this.bookingForm.patchValue({ preferredLocation: location });
          console.log('[Extraction] Location:', location);
          break;
        }
      }
    }

    // 4. Extract PREFERRED DATE and TIME
    const datePatterns = [
      /(?:on|for)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /(?:next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)/i,
      /(?:tomorrow|today)/i,
      /(?:on|for)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i,
      /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/
    ];
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match && !this.bookingForm.get('preferredDate')?.value) {
        const date = match[1] ? match[1].trim() : match[0].trim();
        this.bookingForm.patchValue({ preferredDate: date });
        console.log('[Extraction] Preferred Date:', date);
        break;
      }
    }

    const timePatterns = [
      /(?:at|around|about)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)/i,
      /(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))/i,
      /(?:morning|afternoon|evening)/i,
      /(?:early|late)\s+(?:morning|afternoon)/i
    ];
    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match && !this.bookingForm.get('preferredTime')?.value) {
        const time = match[1] ? match[1].trim() : match[0].trim();
        this.bookingForm.patchValue({ preferredTime: time });
        console.log('[Extraction] Preferred Time:', time);
        break;
      }
    }

    // 5. Extract FULL NAME (first + last)
    const namePatterns = [
      /(?:name is|I'm|I am|my name's|call me)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /^([A-Z][a-z]+)\s+([A-Z][a-z]+)$/,  // Direct: "John Smith"
      /(?:first name is|first name's)\s+([A-Z][a-z]+)/i,
      /(?:last name is|last name's|surname is)\s+([A-Z][a-z]+)/i
    ];
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[2]) {
          // Full name match
          if (!this.bookingForm.get('firstName')?.value) {
            this.bookingForm.patchValue({ firstName: match[1].trim(), lastName: match[2].trim() });
            console.log('[Extraction] Full Name:', match[1], match[2]);
          }
        } else if (match[1]) {
          // Single name - determine if first or last
          if (pattern.source.includes('first') && !this.bookingForm.get('firstName')?.value) {
            this.bookingForm.patchValue({ firstName: match[1].trim() });
            console.log('[Extraction] First Name:', match[1]);
          } else if (pattern.source.includes('last') && !this.bookingForm.get('lastName')?.value) {
            this.bookingForm.patchValue({ lastName: match[1].trim() });
            console.log('[Extraction] Last Name:', match[1]);
          }
        }
        break;
      }
    }

    // 6. Extract DATE OF BIRTH
    const dobPatterns = [
      /(?:date of birth|birthday|born on|dob is|born|birthday is|birthdate is)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
      /(?:date of birth|birthday|born|dob is|birthdate)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /(?:I was born|I'm born)\s+(?:on\s+)?(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /^(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})$/,  // Direct: "January 15, 1990"
      /^(\d{1,2}\/\d{1,2}\/\d{2,4})$/  // Direct: "01/15/1990"
    ];
    for (const pattern of dobPatterns) {
      const match = text.match(pattern);
      if (match && !this.bookingForm.get('dob')?.value) {
        this.bookingForm.patchValue({ dob: match[1].trim() });
        console.log('[Extraction] DOB:', match[1]);
        break;
      }
    }

    // 7. Extract SEX/GENDER
    if (/^(male|female|man|woman|m|f)$/i.test(lowerText.trim())) {
      const normalizedSex = /^(male|man|m)$/i.test(lowerText.trim()) ? 'M' : 'F';
      this.bookingForm.patchValue({ sex: normalizedSex });
      console.log('[Extraction] Sex (direct):', normalizedSex);
    } else {
      const sexPatterns = [
        /(?:sex is|gender is|I am a|I'm a)\s+(male|female|man|woman)/i,
        /(?:I am|I'm)\s+(male|female)/i
      ];
      for (const pattern of sexPatterns) {
        const match = text.match(pattern);
        if (match && !this.bookingForm.get('sex')?.value) {
          const sexValue = match[1].toLowerCase();
          const normalizedSex = (sexValue === 'male' || sexValue === 'man') ? 'M' : 'F';
          this.bookingForm.patchValue({ sex: normalizedSex });
          console.log('[Extraction] Sex:', normalizedSex);
          break;
        }
      }
    }

    // 8. Extract ADDRESS (raw string)
    const addressPatterns = [
      /(?:live at|address is|I live at|my address is|located at)\s+(.+)/i,
      /(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct|place|pl))/i
    ];
    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match && !this.bookingForm.get('address')?.value) {
        const address = match[1].trim();
        this.bookingForm.patchValue({ address });
        console.log('[Extraction] Address (raw):', address);
        break;
      }
    }

    // 9. Extract EMAIL
    // Standard email pattern
    const emailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
    if (emailMatch && !this.bookingForm.get('email')?.value) {
      this.bookingForm.patchValue({ email: emailMatch[1].toLowerCase() });
      console.log('[Extraction] Email:', emailMatch[1]);
    } else {
      // Spoken email pattern: "john at gmail dot com"
      const spokenEmailMatch = text.match(/([a-z0-9._%+-]+)\s+(?:at|@)\s+([a-z0-9.-]+)\s+(?:dot|\.)\s+(com|org|net|edu|gov|io|co)/i);
      if (spokenEmailMatch && !this.bookingForm.get('email')?.value) {
        const email = `${spokenEmailMatch[1]}@${spokenEmailMatch[2]}.${spokenEmailMatch[3]}`.toLowerCase();
        this.bookingForm.patchValue({ email });
        console.log('[Extraction] Email (spoken):', email);
      }
    }

    // 10. Extract PHONE NUMBER
    const phonePatterns = [
      /\b(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/,
      /(?:phone|number|cell|mobile)\s+(?:is\s+)?(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/i,
      /(?:call me at|reach me at)\s+(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/i
    ];
    for (const pattern of phonePatterns) {
      const match = text.match(pattern);
      if (match && !this.bookingForm.get('phone')?.value) {
        this.bookingForm.patchValue({ phone: match[1] });
        console.log('[Extraction] Phone:', match[1]);
        break;
      }
    }

    // 11. Extract INSURANCE PROVIDER
    const insuranceProviders = [
      'Blue Cross', 'Blue Shield', 'BCBS', 'Aetna', 'Cigna', 'United Healthcare', 'UnitedHealthcare',
      'Humana', 'Kaiser', 'Kaiser Permanente', 'Anthem', 'Medicare', 'Medicaid', 'Oscar', 'Molina',
      'Tricare', 'Emblem Health', 'EmblemHealth', 'Oxford', 'Fidelis', 'Health First', 'Healthfirst',
      'MetroPlus', 'Amerigroup', 'WellCare', 'Centene', 'Highmark'
    ];
    for (const provider of insuranceProviders) {
      if (lowerText.includes(provider.toLowerCase())) {
        this.bookingForm.patchValue({ insuranceProvider: provider });
        console.log('[Extraction] Insurance Provider:', provider);
        break;
      }
    }

    // Also check for insurance context patterns
    const insurancePatterns = [
      /(?:insurance is|have|with|through|covered by)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:insurance|health|plan))?$/i,
      /(?:my insurance|insurance provider|carrier)\s+(?:is\s+)?([A-Z][a-zA-Z\s]+)/i
    ];
    for (const pattern of insurancePatterns) {
      const match = text.match(pattern);
      if (match && !this.bookingForm.get('insuranceProvider')?.value) {
        this.bookingForm.patchValue({ insuranceProvider: match[1].trim() });
        console.log('[Extraction] Insurance Provider (contextual):', match[1]);
        break;
      }
    }

    // 12. Extract INSURANCE ID / MEMBER ID
    const insuranceIdPatterns = [
      /(?:insurance id|member id|policy number|id number|member number|subscriber id)\s+(?:is\s+)?([A-Z0-9]+)/i,
      /(?:id is|number is)\s+([A-Z0-9]{6,})/i,
      /^([A-Z]{2,4}[0-9]{6,12}|[0-9]{9,12})$/i  // Direct ID pattern
    ];
    for (const pattern of insuranceIdPatterns) {
      const match = text.match(pattern);
      if (match && !this.bookingForm.get('insuranceId')?.value) {
        this.bookingForm.patchValue({ insuranceId: match[1].trim().toUpperCase() });
        console.log('[Extraction] Insurance ID:', match[1]);
        break;
      }
    }
  }

  /**
   * Parse an address string into components (street, city, state, zip)
   */
  private parseAddress(address: string): { street?: string; city?: string; state?: string; zip?: string } {
    const result: { street?: string; city?: string; state?: string; zip?: string } = {};

    // Extract zip code
    const zipMatch = address.match(/\b(\d{5}(?:-\d{4})?)\b/);
    if (zipMatch) {
      result.zip = zipMatch[1];
      address = address.replace(zipMatch[0], '').trim();
    }

    // Extract state
    const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
    for (const state of states) {
      const stateRegex = new RegExp(`\\b${state}\\b`, 'i');
      if (stateRegex.test(address)) {
        result.state = state;
        address = address.replace(stateRegex, '').trim();
        break;
      }
    }

    // Split remaining by comma
    const parts = address.split(',').map(p => p.trim()).filter(p => p);
    if (parts.length >= 2) {
      result.street = parts[0];
      result.city = parts[1];
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
   * Cleanup raw address into structured fields at the end of collection.
   * Keeps the original raw address while backfilling derived fields if missing.
   */
  private cleanupAddressFields(data: BookingFormData): BookingFormData {
    if (!data.address) return data;

    const normalized = { ...data };
    const hasParsedParts = normalized.addressStreet || normalized.addressCity || normalized.addressState || normalized.addressZip;

    if (!hasParsedParts) {
      const parsed = this.parseAddress(normalized.address);
      if (parsed.street) normalized.addressStreet = parsed.street;
      if (parsed.city) normalized.addressCity = parsed.city;
      if (parsed.state) normalized.addressState = parsed.state;
      if (parsed.zip) normalized.addressZip = parsed.zip;
    }

    return normalized;
  }

  /**
   * Try to extract missing data from the last few messages when call ends
   * Looks for assistant messages that might contain a summary
   */
  private tryExtractFromLastMessages(): void {
    // Get the last few assistant messages
    const recentAssistantMessages = this.messages
      .filter(m => m.role === 'assistant')
      .slice(-3);  // Last 3 assistant messages

    for (const message of recentAssistantMessages) {
      // Check if this looks like a summary message
      const content = message.content.toLowerCase();
      const isSummaryLike =
        content.includes('confirm') ||
        content.includes('summary') ||
        content.includes('collected') ||
        content.includes('information') ||
        content.includes('let me repeat') ||
        content.includes('here\'s what') ||
        content.includes('you provided') ||
        content.includes('booking details');

      if (isSummaryLike) {
        console.log('[End of Call] Found summary-like message:', message.content);
        this.extractFromSummary(message.content);
      }
    }

    // Also try to extract from user messages for any direct answers we may have missed
    const recentUserMessages = this.messages
      .filter(m => m.role === 'user')
      .slice(-10);  // Last 10 user messages

    for (const message of recentUserMessages) {
      this.extractFormData(message.content, 'user');
    }

    console.log('[End of Call] Final form values:', this.bookingForm.value);
  }

  /**
   * Extract data from a summary message at end of call
   * This tries to fill in any missing fields from the assistant's summary
   */
  extractFromSummary(summaryText: string): void {
    console.log('[Summary Extraction] Processing summary:', summaryText);

    const lowerSummary = summaryText.toLowerCase();

    // Try to extract each field if not already filled
    // Test
    if (!this.bookingForm.get('test')?.value) {
      const testMatch = summaryText.match(/(?:test|exam|procedure)(?:\s+is)?[:\s]+([^,.\n]+)/i);
      if (testMatch) {
        const normalizedTest = this.findMedicalTest(testMatch[1]) || this.normalizeTestName(testMatch[1]);
        this.bookingForm.patchValue({ test: normalizedTest });
        console.log('[Summary] Extracted test:', normalizedTest);
      }
    }

    // Name
    if (!this.bookingForm.get('firstName')?.value) {
      const nameMatch = summaryText.match(/(?:name|patient)[:\s]+([A-Z][a-z]+)\s+([A-Z][a-z]+)/i);
      if (nameMatch) {
        this.bookingForm.patchValue({ firstName: nameMatch[1], lastName: nameMatch[2] });
        console.log('[Summary] Extracted name:', nameMatch[1], nameMatch[2]);
      }
    }

    // Date of Birth
    if (!this.bookingForm.get('dob')?.value) {
      const dobMatch = summaryText.match(/(?:date of birth|dob|birthday)[:\s]+(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (dobMatch) {
        this.bookingForm.patchValue({ dob: dobMatch[1].trim() });
        console.log('[Summary] Extracted DOB:', dobMatch[1]);
      }
    }

    // Sex
    if (!this.bookingForm.get('sex')?.value) {
      const sexMatch = summaryText.match(/(?:sex|gender)[:\s]+(male|female|m|f)/i);
      if (sexMatch) {
        const normalizedSex = /^(male|m)$/i.test(sexMatch[1]) ? 'M' : 'F';
        this.bookingForm.patchValue({ sex: normalizedSex });
        console.log('[Summary] Extracted sex:', normalizedSex);
      }
    }

    // Email
    if (!this.bookingForm.get('email')?.value) {
      const emailMatch = summaryText.match(/(?:email)[:\s]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (emailMatch) {
        this.bookingForm.patchValue({ email: emailMatch[1].toLowerCase() });
        console.log('[Summary] Extracted email:', emailMatch[1]);
      }
    }

    // Phone
    if (!this.bookingForm.get('phone')?.value) {
      const phoneMatch = summaryText.match(/(?:phone|number)[:\s]+(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i);
      if (phoneMatch) {
        this.bookingForm.patchValue({ phone: phoneMatch[1] });
        console.log('[Summary] Extracted phone:', phoneMatch[1]);
      }
    }

    // Insurance
    if (!this.bookingForm.get('insuranceProvider')?.value) {
      const insuranceMatch = summaryText.match(/(?:insurance|carrier|provider)[:\s]+([A-Za-z\s]+?)(?:,|\.|$)/i);
      if (insuranceMatch) {
        this.bookingForm.patchValue({ insuranceProvider: insuranceMatch[1].trim() });
        console.log('[Summary] Extracted insurance:', insuranceMatch[1]);
      }
    }

    // Insurance ID
    if (!this.bookingForm.get('insuranceId')?.value) {
      const idMatch = summaryText.match(/(?:member id|insurance id|policy)[:\s]+([A-Z0-9]+)/i);
      if (idMatch) {
        this.bookingForm.patchValue({ insuranceId: idMatch[1].toUpperCase() });
        console.log('[Summary] Extracted insurance ID:', idMatch[1]);
      }
    }

    // Location
    if (!this.bookingForm.get('preferredLocation')?.value) {
      const locationMatch = summaryText.match(/(?:location|clinic|center)[:\s]+([^,.\n]+)/i);
      if (locationMatch) {
        this.bookingForm.patchValue({ preferredLocation: locationMatch[1].trim() });
        console.log('[Summary] Extracted location:', locationMatch[1]);
      }
    }

    // Date
    if (!this.bookingForm.get('preferredDate')?.value) {
      const dateMatch = summaryText.match(/(?:date|appointment)[:\s]+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
      if (dateMatch) {
        this.bookingForm.patchValue({ preferredDate: dateMatch[1].trim() });
        console.log('[Summary] Extracted date:', dateMatch[1]);
      }
    }

    // Time
    if (!this.bookingForm.get('preferredTime')?.value) {
      const timeMatch = summaryText.match(/(?:time)[:\s]+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (timeMatch) {
        this.bookingForm.patchValue({ preferredTime: timeMatch[1].trim() });
        console.log('[Summary] Extracted time:', timeMatch[1]);
      }
    }

    // Reasons
    if (!this.bookingForm.get('reasons')?.value) {
      const reasonsMatch = summaryText.match(/(?:reason|purpose)[:\s]+([^,.\n]+)/i);
      if (reasonsMatch) {
        this.bookingForm.patchValue({ reasons: reasonsMatch[1].trim() });
        console.log('[Summary] Extracted reasons:', reasonsMatch[1]);
      }
    }
  }

  /**
   * Extract medical test name from speech using comprehensive matching.
   * Handles variations, abbreviations, and contextual phrases.
   */
  private extractMedicalTest(text: string): string | null {
    const lowerText = text.toLowerCase().trim();

    // Skip if test field already has a value
    if (this.bookingForm.get('test')?.value) {
      return null;
    }

    // Contextual patterns - phrases that indicate a test is being mentioned
    const contextualPatterns = [
      /(?:i need|i want|i'd like|i would like|schedule|book|get)\s+(?:a|an|the)?\s*(.+?)(?:\s+test|\s+scan|\s+panel|\s+screening)?(?:\s*$|\.|\,)/i,
      /(?:need to get|want to get|have to get|getting)\s+(?:a|an|the)?\s*(.+?)(?:\s+test|\s+scan|\s+panel|\s+screening)?(?:\s*$|\.|\,)/i,
      /(?:schedule|book|get)\s+(?:me\s+)?(?:a|an|the)?\s*(.+?)(?:\s+test|\s+scan|\s+panel)?(?:\s*$|\.|\,)/i,
      /(?:here for|came for|coming for)\s+(?:a|an|the|my)?\s*(.+?)(?:\s+test|\s+scan|\s+panel)?(?:\s*$|\.|\,)/i,
      /(?:my doctor ordered|doctor ordered|ordered)\s+(?:a|an|the)?\s*(.+?)(?:\s+test|\s+scan|\s+panel)?(?:\s*$|\.|\,)/i
    ];

    // Try to extract test name from contextual patterns first
    for (const pattern of contextualPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const potentialTest = match[1].trim().toLowerCase();
        // Try to find this in our medical tests database
        const foundTest = this.findMedicalTest(potentialTest);
        if (foundTest) {
          console.log('[Test Extraction] Found test via contextual pattern:', foundTest);
          return foundTest;
        }
      }
    }

    // Direct matching: check if any test variation is mentioned in the text
    for (const test of this.medicalTests) {
      for (const variation of test.variations) {
        // Use word boundary matching for short abbreviations to avoid false positives
        if (variation.length <= 3) {
          const regex = new RegExp(`\\b${this.escapeRegex(variation)}\\b`, 'i');
          if (regex.test(lowerText)) {
            console.log('[Test Extraction] Found test via direct match (abbreviation):', test.name);
            return test.name;
          }
        } else {
          if (lowerText.includes(variation)) {
            console.log('[Test Extraction] Found test via direct match:', test.name);
            return test.name;
          }
        }
      }
    }

    // Body part + test/scan pattern (e.g., "brain MRI", "chest x-ray", "knee scan")
    const bodyPartPatterns = [
      /\b(brain|head|chest|lung|heart|abdominal|abdomen|knee|shoulder|back|spine|neck|pelvic|hip|ankle|wrist|hand|foot|leg|arm)\s+(mri|ct|ct scan|x-ray|xray|scan|ultrasound|sonogram)/i,
      /\b(mri|ct|ct scan|x-ray|xray|scan|ultrasound|sonogram)\s+(of\s+)?(the\s+)?(brain|head|chest|lung|heart|abdominal|abdomen|knee|shoulder|back|spine|neck|pelvic|hip|ankle|wrist|hand|foot|leg|arm)/i
    ];

    for (const pattern of bodyPartPatterns) {
      const match = text.match(pattern);
      if (match) {
        // Normalize the test name
        const fullMatch = match[0];
        const normalizedTest = this.normalizeTestName(fullMatch);
        console.log('[Test Extraction] Found body part + test pattern:', normalizedTest);
        return normalizedTest;
      }
    }

    return null;
  }

  /**
   * Find a medical test in the database by checking against all variations
   */
  private findMedicalTest(searchText: string): string | null {
    const lowerSearch = searchText.toLowerCase().trim();

    for (const test of this.medicalTests) {
      // Check if search text matches any variation
      for (const variation of test.variations) {
        if (lowerSearch.includes(variation) || variation.includes(lowerSearch)) {
          return test.name;
        }
      }
      // Also check if the canonical name matches
      if (test.name.toLowerCase().includes(lowerSearch)) {
        return test.name;
      }
    }
    return null;
  }

  /**
   * Normalize test name to a standard format
   */
  private normalizeTestName(rawTest: string): string {
    const lower = rawTest.toLowerCase().trim();

    // Map common variations to standard names
    const normalizations: Record<string, string> = {
      'xray': 'X-Ray',
      'x-ray': 'X-Ray',
      'x ray': 'X-Ray',
      'ct': 'CT Scan',
      'ct scan': 'CT Scan',
      'cat scan': 'CT Scan',
      'mri': 'MRI',
      'ultrasound': 'Ultrasound',
      'sonogram': 'Ultrasound',
      'echo': 'Echocardiogram',
      'ecg': 'ECG/EKG',
      'ekg': 'ECG/EKG'
    };

    // Check for body part prefix
    const bodyParts = ['brain', 'head', 'chest', 'lung', 'heart', 'abdominal', 'abdomen', 'knee',
                       'shoulder', 'back', 'spine', 'neck', 'pelvic', 'hip', 'ankle', 'wrist',
                       'hand', 'foot', 'leg', 'arm'];

    let bodyPart = '';
    let testType = lower;

    for (const part of bodyParts) {
      if (lower.includes(part)) {
        bodyPart = part.charAt(0).toUpperCase() + part.slice(1);
        testType = lower.replace(part, '').replace(/\s+of\s+the\s+|\s+of\s+/g, ' ').trim();
        break;
      }
    }

    // Normalize the test type
    for (const [key, value] of Object.entries(normalizations)) {
      if (testType.includes(key)) {
        testType = value;
        break;
      }
    }

    if (bodyPart) {
      return `${bodyPart} ${testType}`;
    }

    return testType.charAt(0).toUpperCase() + testType.slice(1);
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private updateFormFromParams(params: any): void {
    console.log('Updating form with params (legacy):', params);

    // Comprehensive field mapping - all possible variations to correct form field
    // Order: 1. Test, 2. Reasons, 3. Location, 4. Date, 5. Time, 6. First Name, 7. Last Name,
    // 8. DOB, 9. Sex, 10. Address (street, city, state, zip), 11. Email, 12. Phone,
    // 13. Insurance Provider, 14. Insurance ID
    const fieldMapping: Record<string, keyof BookingFormData> = {
      // 1. Test variations
      test: 'test',
      test_type: 'test',
      test_name: 'test',
      testType: 'test',
      testName: 'test',

      // 2. Reasons variations
      reasons: 'reasons',
      reason: 'reasons',
      reason_for_test: 'reasons',
      reasonForTest: 'reasons',

      // 3. Location variations (city, state or zipcode)
      location: 'preferredLocation',
      preferred_location: 'preferredLocation',
      preferredLocation: 'preferredLocation',
      clinic_location: 'preferredLocation',
      clinicLocation: 'preferredLocation',
      // Note: 'city' alone goes to preferredLocation for test location, not address city
      
      // 4. Date variations
      date: 'preferredDate',
      preferred_date: 'preferredDate',
      preferredDate: 'preferredDate',
      appointment_date: 'preferredDate',
      appointmentDate: 'preferredDate',

      // 5. Time variations
      time: 'preferredTime',
      preferred_time: 'preferredTime',
      preferredTime: 'preferredTime',
      appointment_time: 'preferredTime',
      appointmentTime: 'preferredTime',

      // 6. First Name variations
      firstName: 'firstName',
      first_name: 'firstName',
      firstname: 'firstName',

      // 7. Last Name variations
      lastName: 'lastName',
      last_name: 'lastName',
      lastname: 'lastName',

      // 8. DOB variations
      dob: 'dob',
      date_of_birth: 'dob',
      dateOfBirth: 'dob',
      birthday: 'dob',
      birth_date: 'dob',
      birthDate: 'dob',

      // 9. Sex variations
      sex: 'sex',
      gender: 'sex',

      // 10. Address variations (single raw field)
      address: 'address',
      street: 'address',
      street_address: 'address',
      addressStreet: 'address',
      streetAddress: 'address',
      address_street: 'address',
      
      addressCity: 'address',
      address_city: 'address',
      // 'city' is intentionally NOT mapped here - it goes to preferredLocation
      
      state: 'address',
      addressState: 'address',
      address_state: 'address',
      
      zip: 'address',
      zipCode: 'address',
      zip_code: 'address',
      addressZip: 'address',
      address_zip: 'address',
      postal_code: 'address',
      postalCode: 'address',

      // 11. Email variations
      email: 'email',
      email_address: 'email',
      emailAddress: 'email',

      // 12. Phone variations
      phone: 'phone',
      phone_number: 'phone',
      phoneNumber: 'phone',
      mobile: 'phone',
      cell: 'phone',

      // 13. Insurance Provider variations
      insurance: 'insuranceProvider',
      insurance_provider: 'insuranceProvider',
      insuranceProvider: 'insuranceProvider',
      insurance_carrier: 'insuranceProvider',
      insuranceCarrier: 'insuranceProvider',
      insurance_company: 'insuranceProvider',
      insuranceCompany: 'insuranceProvider',
      carrier: 'insuranceProvider',

      // 14. Insurance ID variations
      insurance_id: 'insuranceId',
      insuranceId: 'insuranceId',
      member_id: 'insuranceId',
      memberId: 'insuranceId',
      policy_number: 'insuranceId',
      policyNumber: 'insuranceId',
      subscriber_id: 'insuranceId',
      subscriberId: 'insuranceId',

      // Other
      has_doctor_order: 'hasDoctorOrder',
      hasDoctorOrder: 'hasDoctorOrder',
      doctor_order: 'hasDoctorOrder',
      doctorOrder: 'hasDoctorOrder'
    };

    Object.entries(params).forEach(([key, value]) => {
      const formKey = fieldMapping[key];
      if (!formKey) {
        console.log(`[Legacy] Skipping unknown field: ${key}`);
        return;
      }
      
      if (this.bookingForm.contains(formKey as string) && value !== undefined && value !== null && value !== '') {
        let processedValue = value;

        // Normalize test names
        if (formKey === 'test' && typeof value === 'string') {
          const normalizedTest = this.findMedicalTest(value) || this.normalizeTestName(value);
          processedValue = normalizedTest;
          console.log(`[Legacy] Normalized test "${value}" to "${normalizedTest}"`);
        }

        // Normalize sex/gender
        if (formKey === 'sex' && typeof value === 'string') {
          const lowerSex = value.toLowerCase().trim();
          processedValue = (lowerSex === 'male' || lowerSex === 'm' || lowerSex === 'man') ? 'Male' :
                          (lowerSex === 'female' || lowerSex === 'f' || lowerSex === 'woman') ? 'Female' : value;
        }

        // Normalize email to lowercase
        if (formKey === 'email' && typeof value === 'string') {
          processedValue = value.toLowerCase();
        }

        this.bookingForm.patchValue({ [formKey]: processedValue });
        console.log(`[Legacy] Set ${formKey} to:`, processedValue);
      }
    });
  }

  private addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    const message: ChatMessage = {
      role,
      content,
      timestamp: new Date()
    };

    this.messages.push(message);

    // Keep a running list of user answers for the response column
    if (role === 'user' && content.trim()) {
      this.userResponses.push(message);
    }

    this.shouldScrollToBottom = true;
    this.triggerViewUpdate();
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

  /**
   * Force change detection when external (non-Angular) events update the view.
   */
  private triggerViewUpdate(): void {
    if (!(this.cdr as any)?.destroyed) {
      this.cdr.detectChanges();
    }
  }

  async toggleCall(): Promise<void> {
    // If currently connecting, cancel the connection attempt
    if (this.isConnecting) {
      console.log('Cancelling connection attempt');
      this.clearConnectionTimeout();
      this.vapiService.endCall();
      this.isConnecting = false;
      this.addSystemMessage('Connection cancelled.');
      this.triggerViewUpdate();
      return;
    }

    // If call is active, end it
    if (this.isCallActive) {
      console.log('Ending active call');
      this.clearConnectionTimeout();
      this.vapiService.endCall();
      // Reset state immediately as backup (onCallEnd listener may not fire reliably)
      this.isCallActive = false;
      this.isSpeaking = false;
      this.isListening = false;
      this.addSystemMessage('Call ended.');
      this.triggerViewUpdate();
      return;
    }

    // Start a new call
    this.userResponses = [];
    this.isConnecting = true;
    this.addSystemMessage('Connecting to assistant...');
    this.triggerViewUpdate();

    // Set a connection timeout (15 seconds)
    this.connectionTimeout = setTimeout(() => {
      if (this.isConnecting && !this.isCallActive) {
        console.log('Connection timeout');
        this.vapiService.endCall();
        this.isConnecting = false;
        this.addSystemMessage('Connection timed out. Please try again.');
        this.triggerViewUpdate();
      }
    }, 15000);

    try {
      await this.vapiService.startCall();
    } catch (error) {
      console.error('Failed to start call:', error);
      this.clearConnectionTimeout();
      this.isConnecting = false;
      this.addSystemMessage('Failed to connect. Please try again.');
      this.triggerViewUpdate();
    }
  }

  get callButtonText(): string {
    if (this.isConnecting) return 'Cancel';
    return this.isCallActive ? 'End Call' : 'Start Call';
  }

  get statusText(): string {
    if (this.isConnecting) return 'Connecting...';
    if (!this.isCallActive) return 'Ready to call';
    if (this.isPaused) return 'Paused - click Resume to continue';
    if (this.isSpeaking) return 'Assistant is speaking...';
    if (this.isListening) return 'Listening...';
    return 'Connected';
  }

  /**
   * Toggle pause/resume state of the call.
   * When paused, the microphone is muted and the assistant waits.
   * When resumed, the conversation continues from where it was paused.
   */
  togglePause(): void {
    this.isPaused = this.vapiService.togglePause();
    if (this.isPaused) {
      this.addSystemMessage('Call paused. Click Resume to continue the conversation.');
    } else {
      this.addSystemMessage('Call resumed. Continue speaking...');
    }
    this.triggerViewUpdate();
  }

  get pauseButtonText(): string {
    return this.isPaused ? 'Resume' : 'Pause';
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

    // Try to extract any remaining data from conversation before closing
    this.tryExtractFromLastMessages();

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
    
    const normalizedData = this.cleanupAddressFields(cleanedData);
    console.log('Emitting booking data:', normalizedData);
    this.bookingDataCollected.emit(normalizedData);
  }

  proceedToBooking(): void {
    // End call if active
    if (this.isCallActive) {
      this.vapiService.endCall();
    }

    // Try to extract any remaining data from conversation
    this.tryExtractFromLastMessages();

    // Emit the collected data and close the assistant
    this.emitBookingData();

    this.closeAssistant.emit();
  }

  // Get collected data from both form and service
  getCollectedData(): BookingFormData {
    const merged = {
      ...this.bookingForm.value,
      ...this.vapiService.getCollectedData()
    };
    return this.cleanupAddressFields(merged);
  }
}
