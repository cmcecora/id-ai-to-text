// src/app/components/vapi-call/vapi-call.component.ts
import { Component, OnInit, OnDestroy, Output, EventEmitter, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { VapiService, VoiceBookingData } from '../../services/vapi.service';

@Component({
  selector: 'app-vapi-call',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="vapi-call-container">
      <div class="status">{{ status }}</div>
      
      <div class="transcript" *ngIf="transcript">
        <p>{{ transcript }}</p>
      </div>

      <!-- Display collected booking data -->
      <div class="booking-data" *ngIf="hasBookingData()">
        <h4>Collected Data:</h4>
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
      background: #e8f5e9;
      border-radius: 8px;
      margin-top: 1rem;
    }
    .booking-data h4 {
      margin: 0 0 0.5rem 0;
      color: #2e7d32;
    }
    .booking-data ul {
      margin: 0;
      padding-left: 1.5rem;
    }
    .booking-data li {
      margin: 0.25rem 0;
    }
  `]
})
export class VapiCallComponent implements OnInit, OnDestroy {
  @Output() bookingDataReceived = new EventEmitter<VoiceBookingData>();

  isCallActive = false;
  isConnecting = false;
  status = 'Ready to call';
  transcript = '';
  bookingData: VoiceBookingData = {};

  private bookingDataSubscription?: Subscription;

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
    // Subscribe to booking data updates from VapiService
    this.bookingDataSubscription = this.vapiService.bookingData$.subscribe(
      (data: VoiceBookingData) => {
        this.ngZone.run(() => {
          console.log('VapiCallComponent received booking data:', data);
          this.bookingData = { ...this.bookingData, ...data };
          this.bookingDataReceived.emit(this.bookingData);
        });
      }
    );

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
      // Reset booking data at start of new call
      this.bookingData = {};
      await this.vapiService.startCall();
    }
  }

  ngOnDestroy() {
    if (this.isCallActive) {
      this.vapiService.endCall();
    }
    this.bookingDataSubscription?.unsubscribe();
  }
}