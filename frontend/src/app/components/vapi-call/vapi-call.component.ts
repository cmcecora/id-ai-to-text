// src/app/components/vapi-call/vapi-call.component.ts
import { Component, OnInit, OnDestroy, Output, EventEmitter, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { VapiService, VoiceBookingData, AppointmentBookingData } from '../../services/vapi.service';

@Component({
  selector: 'app-vapi-call',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="vapi-call-container">
      <div class="status" [class.confirmed]="bookingConfirmed">{{ status }}</div>
      
      <div class="transcript" *ngIf="transcript">
        <p>{{ transcript }}</p>
      </div>

      <!-- Display collected booking data (incremental) -->
      <div class="booking-data" *ngIf="hasBookingData() && !bookingConfirmed">
        <h4>Collecting Data:</h4>
        <ul>
          <li *ngIf="bookingData.firstName">First Name: {{ bookingData.firstName }}</li>
          <li *ngIf="bookingData.lastName">Last Name: {{ bookingData.lastName }}</li>
          <li *ngIf="bookingData.test">Test: {{ bookingData.test }}</li>
          <li *ngIf="bookingData.preferredDate">Date: {{ bookingData.preferredDate }}</li>
          <li *ngIf="bookingData.preferredTime">Time: {{ bookingData.preferredTime }}</li>
          <li *ngIf="bookingData.email">Email: {{ bookingData.email }}</li>
          <li *ngIf="bookingData.phone">Phone: {{ bookingData.phone }}</li>
        </ul>
      </div>

      <!-- Display confirmed appointment booking -->
      <div class="appointment-confirmed" *ngIf="bookingConfirmed && appointmentData">
        <h4>🎉 Appointment Confirmed!</h4>
        <div class="confirmation-details">
          <div class="detail-row">
            <span class="label">Name:</span>
            <span class="value">{{ appointmentData.first_name }} {{ appointmentData.last_name }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Tests:</span>
            <span class="value">{{ appointmentData.tests.join(', ') }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Date:</span>
            <span class="value">{{ appointmentData.preferred_date }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Time:</span>
            <span class="value">{{ appointmentData.preferred_time }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Location:</span>
            <span class="value">{{ appointmentData.location }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Email:</span>
            <span class="value">{{ appointmentData.email }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Phone:</span>
            <span class="value">{{ appointmentData.phone_number }}</span>
          </div>
          <div class="detail-row" *ngIf="appointmentData.insurance_carrier">
            <span class="label">Insurance:</span>
            <span class="value">{{ appointmentData.insurance_carrier }} ({{ appointmentData.insurance_id }})</span>
          </div>
        </div>
      </div>

      <button 
        (click)="toggleCall()" 
        [class.active]="isCallActive"
        [disabled]="isConnecting">
        {{ buttonText }}
      </button>
    </div>
  `,
  styles: [`
    .vapi-call-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 2rem;
    }
    .status {
      font-size: 1.1rem;
      font-weight: 500;
    }
    .status.confirmed {
      color: #2e7d32;
      font-size: 1.3rem;
    }
    button {
      padding: 1rem 2rem;
      font-size: 1rem;
      border-radius: 50px;
      border: none;
      cursor: pointer;
      background: #4CAF50;
      color: white;
    }
    button.active {
      background: #f44336;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .transcript {
      max-width: 400px;
      padding: 1rem;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .booking-data {
      max-width: 400px;
      padding: 1rem;
      background: #fff3e0;
      border-radius: 8px;
      margin-top: 1rem;
      border: 1px solid #ffcc80;
    }
    .booking-data h4 {
      margin: 0 0 0.5rem 0;
      color: #e65100;
    }
    .booking-data ul {
      margin: 0;
      padding-left: 1.5rem;
    }
    .booking-data li {
      margin: 0.25rem 0;
    }
    .appointment-confirmed {
      max-width: 450px;
      padding: 1.5rem;
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
      border-radius: 12px;
      margin-top: 1rem;
      border: 2px solid #4CAF50;
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
    }
    .appointment-confirmed h4 {
      margin: 0 0 1rem 0;
      color: #2e7d32;
      font-size: 1.3rem;
      text-align: center;
    }
    .confirmation-details {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .detail-row {
      display: flex;
      gap: 0.5rem;
    }
    .detail-row .label {
      font-weight: 600;
      color: #1b5e20;
      min-width: 90px;
    }
    .detail-row .value {
      color: #2e7d32;
    }
  `]
})
export class VapiCallComponent implements OnInit, OnDestroy {
  @Output() bookingDataReceived = new EventEmitter<VoiceBookingData>();
  @Output() appointmentBooked = new EventEmitter<AppointmentBookingData>();

  isCallActive = false;
  isConnecting = false;
  status = 'Ready to call';
  transcript = '';
  bookingData: VoiceBookingData = {};
  appointmentData: AppointmentBookingData | null = null;
  bookingConfirmed = false;

  private bookingDataSubscription?: Subscription;
  private toolCallCallback?: (data: AppointmentBookingData) => void;

  constructor(
    private vapiService: VapiService,
    private ngZone: NgZone
  ) {}

  get buttonText(): string {
    if (this.isConnecting) return 'Connecting...';
    return this.isCallActive ? 'End Call' : 'Start Call';
  }

  hasBookingData(): boolean {
    return Object.keys(this.bookingData).some(key => 
      this.bookingData[key as keyof VoiceBookingData] !== undefined &&
      this.bookingData[key as keyof VoiceBookingData] !== null &&
      this.bookingData[key as keyof VoiceBookingData] !== ''
    );
  }

  ngOnInit() {
    // Subscribe to booking data updates from VapiService (incremental updates)
    this.bookingDataSubscription = this.vapiService.bookingData$.subscribe(
      (data: VoiceBookingData) => {
        this.ngZone.run(() => {
          console.log('VapiCallComponent received booking data:', data);
          this.bookingData = { ...this.bookingData, ...data };
          this.bookingDataReceived.emit(this.bookingData);
        });
      }
    );

    // Option B: Listen for save_appointment_booking tool calls directly in Angular
    this.toolCallCallback = (bookingData: AppointmentBookingData) => {
      this.ngZone.run(() => {
        console.log('🎉 Appointment Booking Received:', bookingData);
        this.appointmentData = bookingData;
        this.bookingConfirmed = true;
        this.appointmentBooked.emit(bookingData);
        
        // You can send to your API here, display confirmation, etc.
        this.handleAppointmentBooking(bookingData);
      });
    };
    this.vapiService.onToolCall(this.toolCallCallback);

    // VAPI events fire outside Angular's zone
    this.vapiService.onCallStart(() => {
      this.ngZone.run(() => {
        this.isCallActive = true;
        this.isConnecting = false;
        this.status = 'Connected - Speak now';
      });
    });

    this.vapiService.onCallEnd(() => {
      this.ngZone.run(() => {
        this.isCallActive = false;
        this.isConnecting = false;
        this.status = 'Call ended';
      });
    });

    this.vapiService.onSpeechStart(() => {
      this.ngZone.run(() => {
        this.status = 'Assistant is speaking...';
      });
    });

    this.vapiService.onSpeechEnd(() => {
      this.ngZone.run(() => {
        this.status = 'Listening...';
      });
    });

    this.vapiService.onTranscript((message) => {
      this.ngZone.run(() => {
        // Handle regular transcripts
        if (message.type === 'transcript' && message.transcriptType === 'final') {
          this.transcript = message.transcript;
        }
        
        // Handle tool-calls from VAPI
        // When the LLM calls the update_booking_form function, it comes through here
        if (message.type === 'tool-calls' && message.toolCalls) {
          this.handleToolCalls(message.toolCalls);
        }
      });
    });

    this.vapiService.onError((error) => {
      this.ngZone.run(() => {
        console.error('Vapi error:', error);
        this.status = 'Error occurred';
        this.isConnecting = false;
      });
    });
  }

  /**
   * Handle tool calls from VAPI assistant.
   * When the LLM decides to call the update_booking_form function,
   * the structured JSON data is sent here.
   */
  private handleToolCalls(toolCalls: any[]): void {
    for (const toolCall of toolCalls) {
      if (toolCall.type === 'function' && toolCall.function) {
        const { name, arguments: args } = toolCall.function;
        
        if (name === 'update_booking_form') {
          console.log('VapiCallComponent: Processing tool call:', { id: toolCall.id, name, args });
          
          // Delegate to VapiService which handles parsing and emits via bookingData$
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

  async toggleCall() {
    if (this.isCallActive) {
      this.vapiService.endCall();
    } else {
      this.isConnecting = true;
      this.status = 'Connecting...';
      // Reset all booking data at start of new call
      this.bookingData = {};
      this.appointmentData = null;
      this.bookingConfirmed = false;
      await this.vapiService.startCall();
    }
  }

  /**
   * Handle the completed appointment booking.
   * This is called when the assistant has collected all information
   * and called the save_appointment_booking tool.
   */
  private handleAppointmentBooking(bookingData: AppointmentBookingData): void {
    console.log('Processing appointment booking:', bookingData);
    
    // Example: Send to your backend API
    // this.apiService.createAppointment(bookingData).subscribe({
    //   next: (response) => {
    //     console.log('Appointment created:', response);
    //     this.status = 'Booking confirmed!';
    //   },
    //   error: (error) => {
    //     console.error('Failed to create appointment:', error);
    //     this.status = 'Booking failed - please try again';
    //   }
    // });

    // For now, just log and update status
    this.status = '✅ Booking confirmed!';
  }

  ngOnDestroy() {
    if (this.isCallActive) {
      this.vapiService.endCall();
    }
    this.bookingDataSubscription?.unsubscribe();
    
    // Clean up the tool call callback
    if (this.toolCallCallback) {
      this.vapiService.removeToolCallListener(this.toolCallCallback);
    }
  }
}