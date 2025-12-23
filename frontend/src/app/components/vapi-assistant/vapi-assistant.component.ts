import { Component, OnInit, OnDestroy, Output, EventEmitter, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { trigger, style, animate, transition, state } from '@angular/animations';
import { VapiService } from '../../services/vapi.service';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface BookingFormData {
  fullName?: string;
  sex?: string;
  dob?: string;
  address?: string;
  test?: string;
  reasons?: string;
  testQuestions?: string;
  dateTime?: string;
  location?: string;
  company?: string;
  insurance?: string;
  insuranceId?: string;
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
    { key: 'fullName', label: 'Full name', type: 'text' },
    { key: 'sex', label: 'Sex', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'text' },
    { key: 'address', label: 'Address', type: 'text' },
    { key: 'test', label: 'Test', type: 'text' },
    { key: 'reasons', label: 'Reasons', type: 'text' },
    { key: 'testQuestions', label: 'Test Qs', type: 'text' },
    { key: 'dateTime', label: 'Date/Time', type: 'text' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'company', label: 'Company', type: 'text' },
    { key: 'insurance', label: 'Insurance', type: 'text' },
    { key: 'insuranceId', label: 'InsuranceID', type: 'text' }
  ];

  private shouldScrollToBottom = false;
  private currentTranscript = '';

  constructor(
    private vapiService: VapiService,
    private fb: FormBuilder
  ) {
    this.bookingForm = this.fb.group({
      fullName: [''],
      sex: [''],
      dob: [''],
      address: [''],
      test: [''],
      reasons: [''],
      testQuestions: [''],
      dateTime: [''],
      location: [''],
      company: [''],
      insurance: [''],
      insuranceId: ['']
    });
  }

  ngOnInit(): void {
    this.setupVapiListeners();
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
  }

  private setupVapiListeners(): void {
    this.vapiService.onCallStart(() => {
      this.isCallActive = true;
      this.isConnecting = false;
      this.isListening = true;
      this.addSystemMessage('Connected! You can now speak with the assistant.');
    });

    this.vapiService.onCallEnd(() => {
      this.isCallActive = false;
      this.isConnecting = false;
      this.isSpeaking = false;
      this.isListening = false;
      this.addSystemMessage('Call ended.');
    });

    this.vapiService.onSpeechStart(() => {
      this.isSpeaking = true;
      this.isListening = false;
    });

    this.vapiService.onSpeechEnd(() => {
      this.isSpeaking = false;
      this.isListening = true;
    });

    this.vapiService.onTranscript((message) => {
      this.handleTranscript(message);
    });

    this.vapiService.onError((error) => {
      console.error('Vapi error:', error);
      this.isConnecting = false;
      this.addSystemMessage('An error occurred. Please try again.');
    });
  }

  private handleTranscript(message: any): void {
    // Handle different message types from VAPI
    if (message.type === 'transcript') {
      const role = message.role === 'user' ? 'user' : 'assistant';

      if (message.transcriptType === 'final') {
        this.addMessage(role, message.transcript);
        this.currentTranscript = '';

        // Try to extract form data from assistant messages
        if (role === 'assistant') {
          this.extractFormData(message.transcript);
        }
      }
    } else if (message.type === 'function-call') {
      // Handle function calls from VAPI assistant
      this.handleFunctionCall(message);
    } else if (message.type === 'conversation-update') {
      // Handle conversation updates which contain structured data
      if (message.conversation) {
        this.processConversationUpdate(message.conversation);
      }
    }
  }

  private handleFunctionCall(message: any): void {
    // Handle structured data from VAPI function calls
    if (message.functionCall?.name === 'updateBookingForm' && message.functionCall?.parameters) {
      const params = message.functionCall.parameters;
      this.updateFormFromParams(params);
    }
  }

  private processConversationUpdate(conversation: any[]): void {
    // Process the full conversation for any structured data
    conversation.forEach((msg: any) => {
      if (msg.role === 'assistant' && msg.content) {
        this.extractFormData(msg.content);
      }
    });
  }

  private extractFormData(text: string): void {
    const lowerText = text.toLowerCase();

    // Extract test type
    const testTypes = [
      'Complete Blood Count', 'CBC', 'Lipid Panel', 'Thyroid Panel', 'TSH',
      'Hemoglobin A1C', 'Vitamin D', 'MRI', 'CT Scan', 'X-Ray', 'ECG', 'EKG'
    ];
    for (const testType of testTypes) {
      if (lowerText.includes(testType.toLowerCase())) {
        this.bookingForm.patchValue({ test: testType });
        break;
      }
    }

    // Extract full name patterns
    const nameMatch = text.match(/(?:name is|I'm|I am|patient name is|for|my name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    if (nameMatch) {
      this.bookingForm.patchValue({ fullName: nameMatch[1].trim() });
    }

    // Extract sex/gender
    const sexMatch = text.match(/(?:sex is|gender is|I am a|I'm a)\s+(male|female|man|woman)/i);
    if (sexMatch) {
      const sexValue = sexMatch[1].toLowerCase();
      const normalizedSex = (sexValue === 'male' || sexValue === 'man') ? 'Male' : 'Female';
      this.bookingForm.patchValue({ sex: normalizedSex });
    }

    // Extract date of birth
    const dobMatch = text.match(/(?:date of birth|birthday|born on|dob is)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (dobMatch) {
      this.bookingForm.patchValue({ dob: dobMatch[1].trim() });
    }

    // Extract address
    const addressMatch = text.match(/(?:address is|I live at|my address is)\s+([^.]+)/i);
    if (addressMatch) {
      this.bookingForm.patchValue({ address: addressMatch[1].trim() });
    }

    // Extract reasons for test
    const reasonsMatch = text.match(/(?:reason is|because|for|due to)\s+([^.]+)/i);
    if (reasonsMatch && !this.bookingForm.get('reasons')?.value) {
      this.bookingForm.patchValue({ reasons: reasonsMatch[1].trim() });
    }

    // Extract date/time patterns
    const dateTimeMatch = text.match(/(?:on|for|scheduled for|appointment is)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)/i);
    if (dateTimeMatch) {
      this.bookingForm.patchValue({ dateTime: dateTimeMatch[1].trim() });
    }

    // Extract location/clinic
    const locationPatterns = [
      /(?:at|location is|clinic is|center at)\s+([A-Z][a-zA-Z\s]+(?:Clinic|Center|Hospital|Lab|Laboratory)?)/i
    ];
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        this.bookingForm.patchValue({ location: match[1].trim() });
        break;
      }
    }

    // Extract company/employer
    const companyMatch = text.match(/(?:company is|work at|employer is|work for)\s+([A-Z][a-zA-Z\s&]+)/i);
    if (companyMatch) {
      this.bookingForm.patchValue({ company: companyMatch[1].trim() });
    }

    // Extract insurance info
    const insuranceMatch = text.match(/(?:insurance is|insured by|coverage through|insurance provider is)\s+([A-Z][a-zA-Z\s]+)/i);
    if (insuranceMatch) {
      this.bookingForm.patchValue({ insurance: insuranceMatch[1].trim() });
    }

    // Extract insurance ID
    const insuranceIdMatch = text.match(/(?:insurance id is|member id is|policy number is|id number is)\s+([A-Z0-9]+)/i);
    if (insuranceIdMatch) {
      this.bookingForm.patchValue({ insuranceId: insuranceIdMatch[1].trim() });
    }
  }

  private updateFormFromParams(params: any): void {
    const fieldMapping: Record<string, keyof BookingFormData> = {
      full_name: 'fullName',
      patient_name: 'fullName',
      sex: 'sex',
      gender: 'sex',
      date_of_birth: 'dob',
      dob: 'dob',
      address: 'address',
      test: 'test',
      test_type: 'test',
      reasons: 'reasons',
      reason: 'reasons',
      test_questions: 'testQuestions',
      date_time: 'dateTime',
      preferred_date: 'dateTime',
      preferred_time: 'dateTime',
      location: 'location',
      company: 'company',
      employer: 'company',
      insurance: 'insurance',
      insurance_provider: 'insurance',
      insurance_id: 'insuranceId'
    };

    Object.entries(params).forEach(([key, value]) => {
      const formKey = fieldMapping[key] || key;
      if (this.bookingForm.contains(formKey as string)) {
        this.bookingForm.patchValue({ [formKey]: value });
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
    this.closeAssistant.emit();
  }

  hasFormData(): boolean {
    const values = this.bookingForm.value as Record<string, string>;
    return Object.values(values).some(v => v && String(v).trim() !== '');
  }

  getFilledFields(): { key: string; label: string; value: string }[] {
    const values = this.bookingForm.value as Record<string, string>;
    return this.formFields
      .filter(f => values[f.key] && String(values[f.key]).trim() !== '')
      .map(f => ({
        key: f.key,
        label: f.label,
        value: values[f.key]
      }));
  }

  getFormControl(key: string): FormControl {
    return this.bookingForm.get(key) as FormControl;
  }

  proceedToBooking(): void {
    // TODO: Navigate to booking page with form data
    console.log('Booking form data:', this.bookingForm.value);
  }
}
