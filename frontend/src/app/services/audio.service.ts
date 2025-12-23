import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, timer, Subject } from 'rxjs';
import { catchError, map, switchMap, takeWhile, timeout, tap, filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Audio Upload Response from backend
 */
export interface AudioUploadResponse {
  success: boolean;
  data?: {
    job_id: string;
    file_path: string;
    original_name: string;
    file_size: number;
    mime_type: string;
    audio_duration: number | null;
    transcript_preview: string;
    message: string;
  };
  error?: string;
}

/**
 * Audio Job Status
 */
export interface AudioJobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Audio Extraction Results
 */
export interface AudioExtractionResults {
  job_id: string;
  status: 'completed' | 'failed';
  raw_transcript: string | null;
  extracted_data: ExtractedPatientData | null;
  confidence: { [key: string]: number };
  overall_confidence: number;
  audio_duration: number | null;
  error?: string;
  processed_at?: string;
}

/**
 * Extracted patient data from audio
 */
export interface ExtractedPatientData {
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
  memberId?: string;
}

/**
 * Processing state for UI updates
 */
export interface AudioProcessingState {
  status: 'idle' | 'uploading' | 'transcribing' | 'extracting' | 'completed' | 'error';
  progress: number;
  message: string;
  jobId?: string;
  transcript?: string;
  extractedData?: ExtractedPatientData;
  confidence?: { [key: string]: number };
  overallConfidence?: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private apiUrl = environment.apiUrl || 'http://localhost:8010';

  // Observable for processing state
  private processingStateSubject = new BehaviorSubject<AudioProcessingState>({
    status: 'idle',
    progress: 0,
    message: 'Ready to upload audio'
  });
  public processingState$ = this.processingStateSubject.asObservable();

  // Observable for extracted data
  private extractedDataSubject = new Subject<ExtractedPatientData>();
  public extractedData$ = this.extractedDataSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Upload an audio file for transcription and extraction
   * Returns Observable with job_id for polling
   */
  uploadAudioFile(file: File): Observable<AudioUploadResponse> {
    this.updateState({
      status: 'uploading',
      progress: 10,
      message: 'Uploading audio file...'
    });

    const formData = new FormData();
    formData.append('audio', file);

    return this.http.post<AudioUploadResponse>(`${this.apiUrl}/api/audio/upload`, formData, {
      withCredentials: true
    }).pipe(
      timeout(120000), // 2 minute timeout for large files + transcription
      tap(response => {
        if (response.success && response.data) {
          this.updateState({
            status: 'transcribing',
            progress: 30,
            message: 'Audio transcribed, extracting patient data...',
            jobId: response.data.job_id,
            transcript: response.data.transcript_preview
          });
        }
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): Observable<AudioJobStatus> {
    return this.http.get<any>(`${this.apiUrl}/api/audio/${jobId}/status`, {
      withCredentials: true
    }).pipe(
      map(response => response.data),
      tap(status => {
        const progressMap: { [key: string]: number } = {
          'pending': 35,
          'processing': 60,
          'completed': 100,
          'failed': 0
        };
        this.updateState({
          status: status.status === 'completed' ? 'completed' :
                  status.status === 'failed' ? 'error' : 'extracting',
          progress: progressMap[status.status] || 50,
          message: this.getStatusMessage(status.status)
        });
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Get extraction results
   */
  getResults(jobId: string): Observable<AudioExtractionResults> {
    return this.http.get<any>(`${this.apiUrl}/api/audio/${jobId}`, {
      withCredentials: true
    }).pipe(
      map(response => response.data),
      tap(results => {
        if (results.status === 'completed' && results.extracted_data) {
          this.updateState({
            status: 'completed',
            progress: 100,
            message: 'Extraction complete!',
            extractedData: results.extracted_data,
            confidence: results.confidence,
            overallConfidence: results.overall_confidence
          });
          this.extractedDataSubject.next(results.extracted_data);
        } else if (results.status === 'failed') {
          this.updateState({
            status: 'error',
            progress: 0,
            message: results.error || 'Extraction failed',
            error: results.error
          });
        }
      }),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Poll job status until completion
   */
  pollJobStatus(jobId: string): Observable<AudioJobStatus> {
    return timer(0, 2000).pipe(
      switchMap(() => this.getJobStatus(jobId)),
      takeWhile(status => status.status === 'pending' || status.status === 'processing', true)
    );
  }

  /**
   * Process audio file end-to-end:
   * 1. Upload audio file
   * 2. Wait for transcription + extraction
   * 3. Return extracted data
   */
  processAudioFile(file: File): Observable<AudioProcessingState> {
    return new Observable(observer => {
      this.updateState({
        status: 'uploading',
        progress: 5,
        message: 'Starting upload...'
      });

      // Step 1: Upload audio file
      this.uploadAudioFile(file).subscribe({
        next: (uploadResponse) => {
          if (!uploadResponse.success || !uploadResponse.data) {
            const errorState: AudioProcessingState = {
              status: 'error',
              progress: 0,
              message: uploadResponse.error || 'Upload failed',
              error: uploadResponse.error
            };
            this.updateState(errorState);
            observer.next(errorState);
            observer.complete();
            return;
          }

          const jobId = uploadResponse.data.job_id;
          const transcript = uploadResponse.data.transcript_preview;

          observer.next({
            status: 'transcribing',
            progress: 30,
            message: 'Audio transcribed, extracting fields...',
            jobId,
            transcript
          });

          // Step 2: Poll for job completion
          this.pollJobStatus(jobId).subscribe({
            next: (jobStatus) => {
              observer.next({
                status: 'extracting',
                progress: jobStatus.progress,
                message: this.getStatusMessage(jobStatus.status),
                jobId
              });

              if (jobStatus.status === 'completed') {
                // Step 3: Get final results
                this.getResults(jobId).subscribe({
                  next: (results) => {
                    if (results.status === 'completed' && results.extracted_data) {
                      const completedState: AudioProcessingState = {
                        status: 'completed',
                        progress: 100,
                        message: 'Extraction complete!',
                        jobId,
                        transcript: results.raw_transcript || undefined,
                        extractedData: results.extracted_data,
                        confidence: results.confidence,
                        overallConfidence: results.overall_confidence
                      };
                      this.updateState(completedState);
                      observer.next(completedState);
                    } else {
                      const errorState: AudioProcessingState = {
                        status: 'error',
                        progress: 0,
                        message: results.error || 'Extraction failed',
                        error: results.error
                      };
                      this.updateState(errorState);
                      observer.next(errorState);
                    }
                    observer.complete();
                  },
                  error: (error) => {
                    const errorState: AudioProcessingState = {
                      status: 'error',
                      progress: 0,
                      message: 'Failed to get extraction results',
                      error: error.message
                    };
                    this.updateState(errorState);
                    observer.next(errorState);
                    observer.complete();
                  }
                });
              } else if (jobStatus.status === 'failed') {
                const errorState: AudioProcessingState = {
                  status: 'error',
                  progress: 0,
                  message: 'Field extraction failed',
                  error: 'Extraction processing failed'
                };
                this.updateState(errorState);
                observer.next(errorState);
                observer.complete();
              }
            },
            error: (error) => {
              const errorState: AudioProcessingState = {
                status: 'error',
                progress: 0,
                message: 'Failed to check job status',
                error: error.message
              };
              this.updateState(errorState);
              observer.next(errorState);
              observer.complete();
            }
          });
        },
        error: (error) => {
          const errorState: AudioProcessingState = {
            status: 'error',
            progress: 0,
            message: 'Upload failed',
            error: error.message
          };
          this.updateState(errorState);
          observer.next(errorState);
          observer.complete();
        }
      });
    });
  }

  /**
   * Reset processing state
   */
  reset(): void {
    this.updateState({
      status: 'idle',
      progress: 0,
      message: 'Ready to upload audio'
    });
  }

  /**
   * Get current processing state
   */
  getState(): AudioProcessingState {
    return this.processingStateSubject.getValue();
  }

  /**
   * Get low confidence fields from extraction results
   */
  getLowConfidenceFields(
    confidence: { [key: string]: number },
    threshold: number = 0.7
  ): { field: string; confidence: number }[] {
    const lowFields: { field: string; confidence: number }[] = [];

    for (const [field, score] of Object.entries(confidence)) {
      if (score < threshold) {
        lowFields.push({ field, confidence: score });
      }
    }

    return lowFields.sort((a, b) => a.confidence - b.confidence);
  }

  /**
   * Validate audio file before upload
   */
  validateAudioFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
      'audio/x-m4a',
      'audio/m4a',
      'audio/mp4',
      'audio/webm',
      'audio/ogg'
    ];

    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid audio format. Supported: MP3, WAV, M4A, WebM, OGG'
      };
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File too large. Maximum size is 50MB'
      };
    }

    return { valid: true };
  }

  /**
   * Update processing state
   */
  private updateState(partial: Partial<AudioProcessingState>): void {
    const current = this.processingStateSubject.getValue();
    this.processingStateSubject.next({ ...current, ...partial });
  }

  /**
   * Get status message for display
   */
  private getStatusMessage(status: string): string {
    switch (status) {
      case 'pending':
        return 'Waiting to process...';
      case 'processing':
        return 'Extracting patient information...';
      case 'completed':
        return 'Extraction complete!';
      case 'failed':
        return 'Extraction failed';
      default:
        return 'Processing...';
    }
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      if (error.status === 0) {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      } else if (error.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.status === 413) {
        errorMessage = 'Audio file is too large. Maximum size is 50MB.';
      } else if (error.status === 422) {
        errorMessage = error.error?.error || 'Invalid audio file.';
      } else if (error.status === 429) {
        errorMessage = 'Too many requests. Please wait and try again.';
      } else if (error.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else {
        errorMessage = error.error?.error || `Error: ${error.status}`;
      }
    }

    this.updateState({
      status: 'error',
      progress: 0,
      message: errorMessage,
      error: errorMessage
    });

    console.error('AudioService Error:', {
      status: error.status,
      message: errorMessage,
      error: error.error
    });

    return throwError(() => new Error(errorMessage));
  }
}
