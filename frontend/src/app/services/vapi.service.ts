// src/app/services/vapi.service.ts
import { Injectable } from '@angular/core';
import Vapi from '@vapi-ai/web';

@Injectable({
  providedIn: 'root'
})
export class VapiService {
  private vapi: Vapi;

  // Your assistant ID
  private assistantId = '8bc37d6f-3d2f-48d8-a6cd-dd7a0b9d6eba';

  constructor() {
    // Use your PUBLIC key (starts with pk-), not the private key
    this.vapi = new Vapi('dea287ba-8a6a-42a4-865b-1c26b932968d');
  }

  startCall() {
    return this.vapi.start(this.assistantId);
  }

  endCall() {
    this.vapi.stop();
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