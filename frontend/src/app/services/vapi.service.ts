// src/app/services/vapi.service.ts
import { Injectable, EventEmitter } from '@angular/core';
import { Subject } from 'rxjs';
import Vapi from '@vapi-ai/web';

// Interface for booking form data collected via voice
export interface VoiceBookingData {
  test?: string;
  reasons?: string;
  preferredDate?: string;
  preferredTime?: string;
  preferredLocation?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  sex?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  email?: string;
  phone?: string;
  insuranceProvider?: string;
  insuranceId?: string;
  hasDoctorOrder?: boolean;
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

  // Subject to emit booking form data updates
  private bookingDataSubject = new Subject<VoiceBookingData>();
  public bookingData$ = this.bookingDataSubject.asObservable();

  // Accumulated booking data from the conversation
  private collectedData: VoiceBookingData = {};

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

  // Handle tool calls from Vapi assistant
  handleToolCall(toolCall: { id: string; function: { name: string; arguments: string } }): void {
    const { id, function: func } = toolCall;
    
    if (func.name === 'update_booking_form') {
      try {
        const params: VoiceBookingData = JSON.parse(func.arguments);
        console.log('Tool call received - update_booking_form:', params);
        
        // Merge new data with existing collected data
        this.collectedData = {
          ...this.collectedData,
          ...this.filterUndefined(params)
        };
        
        // Emit the updated data
        this.bookingDataSubject.next(this.collectedData);
        
        // Send success result back to Vapi
        this.sendToolResult(id, { success: true, message: 'Form updated successfully' });
      } catch (error) {
        console.error('Error parsing tool call arguments:', error);
        this.sendToolResult(id, { success: false, error: 'Failed to parse arguments' });
      }
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