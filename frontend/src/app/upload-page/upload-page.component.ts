import { Component, OnInit } from '@angular/core';
import { ApiService, DocumentData } from '../services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-upload-page',
  standalone: false,
  templateUrl: './upload-page.component.html',
  styleUrls: ['./upload-page.component.scss']
})
export class UploadPageComponent implements OnInit {
  isProcessing = false;
  processingProgress = 0;
  ocrData: DocumentData | null = null;
  currentJobId: string | null = null;
  
  // Expose Math to template
  Math = Math;

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
  }

  onFileProcessed(file: File): void {
    this.processDocument(file);
  }

  private processDocument(file: File): void {
    this.isProcessing = true;
    this.processingProgress = 0;
    this.ocrData = null;

    this.apiService.processDocument(file).subscribe({
      next: (response) => {
        switch (response.status) {
          case 'uploading':
            this.processingProgress = 10;
            this.currentJobId = response.data.jobId;
            break;

          case 'processing':
            this.processingProgress = 20 + (response.data.progress * 0.6); // 20% to 80%
            break;

          case 'completed':
            this.processingProgress = 100;
            this.ocrData = response.data.extractedData;
            this.currentJobId = response.data.jobId;
            this.snackBar.open(
              `Document processed successfully with ${Math.round((response.data.confidenceScore || 0) * 100)}% confidence`,
              'Close',
              {
                duration: 5000,
                horizontalPosition: 'center',
                verticalPosition: 'top'
              }
            );
            break;

          case 'error':
            this.isProcessing = false;
            this.processingProgress = 0;
            this.snackBar.open(
              response.error || 'Processing failed',
              'Close',
              {
                duration: 5000,
                horizontalPosition: 'center',
                verticalPosition: 'top'
              }
            );
            break;
        }
      },
      error: (error) => {
        this.isProcessing = false;
        this.processingProgress = 0;
        this.snackBar.open(
          'Failed to process document: ' + error.message,
          'Close',
          {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          }
        );
      },
      complete: () => {
        this.isProcessing = false;
      }
    });
  }

  onDataFormSave(data: DocumentData): void {
    if (this.currentJobId) {
      this.apiService.saveDocumentData(data, this.currentJobId).subscribe({
        next: () => {
          this.snackBar.open(
            'Document information saved successfully!',
            'Close',
            {
              duration: 3000,
              horizontalPosition: 'center',
              verticalPosition: 'top'
            }
          );
        },
        error: (error) => {
          this.snackBar.open(
            'Failed to save document: ' + error.message,
            'Close',
            {
              duration: 5000,
              horizontalPosition: 'center',
              verticalPosition: 'top'
            }
          );
        }
      });
    }
  }

  onDataFormEdit(): void {
    // Handle form edit if needed
    console.log('Form edit requested');
  }
}