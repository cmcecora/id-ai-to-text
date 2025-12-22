// src/app/components/vapi-call/vapi-call.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VapiService } from '../../services/vapi.service';

@Component({
  selector: 'app-vapi-call',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="vapi-call-container">
      <div class="status"> status }}</div>
      
      <div class="transcript" *ngIf="transcript">
        <p>{{ transcript }}</p>
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
  `]
})
export class VapiCallComponent implements OnInit, OnDestroy {
  isCallActive = false;
  isConnecting = false;
  status = 'Ready to call';
  transcript = '';

  constructor(private vapiService: VapiService) {}

  get buttonText(): string {
    if (this.isConnecting) return 'Connecting...';
    return this.isCallActive ? 'End Call' : 'Start Call';
  }

  ngOnInit() {
    this.vapiService.onCallStart(() => {
      this.isCallActive = true;
      this.isConnecting = false;
      this.status = 'Connected - Speak now';
    });

    this.vapiService.onCallEnd(() => {
      this.isCallActive = false;
      this.isConnecting = false;
      this.status = 'Call ended';
    });

    this.vapiService.onSpeechStart(() => {
      this.status = 'Assistant is speaking...';
    });

    this.vapiService.onSpeechEnd(() => {
      this.status = 'Listening...';
    });

    this.vapiService.onTranscript((message) => {
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        this.transcript = message.transcript;
      }
    });

    this.vapiService.onError((error) => {
      console.error('Vapi error:', error);
      this.status = 'Error occurred';
      this.isConnecting = false;
    });
  }

  async toggleCall() {
    if (this.isCallActive) {
      this.vapiService.endCall();
    } else {
      this.isConnecting = true;
      this.status = 'Connecting...';
      await this.vapiService.startCall();
    }
  }

  ngOnDestroy() {
    if (this.isCallActive) {
      this.vapiService.endCall();
    }
  }
}