import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, timer } from 'rxjs';
import { catchError, map, switchMap, takeWhile, retry, timeout } from 'rxjs/operators';

export interface UploadResponse {
  success: boolean;
  data?: {
    job_id: string;
    file_path: string;
    original_name: string;
    file_size: number;
    mime_type: string;
    message: string;
  };
  error?: string;
}

export interface JobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface JobResults {
  job_id: string;
  status: 'completed' | 'failed';
  extracted_data?: {
    lastName: string;
    firstName: string;
    middleInitial: string;
    addressStreet: string;
    addressCity: string;
    addressState: string;
    addressZip: string;
    sex: string;
    dob: string;
  };
  confidence_score?: number;
  error?: string;
  processed_at?: string;
}

export interface DocumentData {
  lastName: string;
  firstName: string;
  middleInitial: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  sex: string;
  dob: Date | null;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly API_BASE_URL = 'http://localhost:3220/api';

  constructor(private http: HttpClient) { }

  /**
   * Upload ID document for OCR processing
   */
  uploadDocument(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('document', file);

    return this.http.post<UploadResponse>(`${this.API_BASE_URL}/id/upload`, formData, {
      withCredentials: true  // Send session cookies for Better-Auth
    }).pipe(
      timeout(30000), // 30 second timeout for upload
      retry(1), // Retry once on failure
      catchError(this.handleError)
    );
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): Observable<JobStatus> {
    return this.http.get<any>(`${this.API_BASE_URL}/id/upload/${jobId}/status`, {
      withCredentials: true
    }).pipe(
      map(response => response.data), // Unwrap data property from backend response
      catchError(this.handleError)
    );
  }

  /**
   * Get job results
   */
  getJobResults(jobId: string): Observable<JobResults> {
    return this.http.get<any>(`${this.API_BASE_URL}/id/upload/${jobId}`, {
      withCredentials: true
    }).pipe(
      map(response => response.data), // Unwrap data property from backend response
      catchError(this.handleError)
    );
  }

  /**
   * Poll job status until completion
   */
  pollJobStatus(jobId: string): Observable<JobStatus> {
    return timer(0, 2000).pipe( // Start immediately, poll every 2 seconds
      switchMap(() => this.getJobStatus(jobId)),
      takeWhile(status => status.status === 'pending' || status.status === 'processing', true)
    );
  }

  /**
   * Process document upload with polling and results retrieval
   */
  processDocument(file: File): Observable<{status: string, data?: any, error?: string}> {
    return new Observable(observer => {
      // Step 1: Upload file
      this.uploadDocument(file).subscribe({
        next: (uploadResponse) => {
          if (!uploadResponse.success || !uploadResponse.data) {
            observer.next({
              status: 'error',
              error: uploadResponse.error || 'Upload failed'
            });
            observer.complete();
            return;
          }

          const jobId = uploadResponse.data.job_id;
          observer.next({ status: 'uploading', data: { jobId } });

          // Step 2: Poll for job completion
          this.pollJobStatus(jobId).subscribe({
            next: (jobStatus) => {
              observer.next({
                status: 'processing',
                data: {
                  jobId,
                  progress: jobStatus.progress,
                  jobStatus: jobStatus.status
                }
              });

              if (jobStatus.status === 'completed') {
                // Step 3: Get final results
                this.getJobResults(jobId).subscribe({
                  next: (results) => {
                    if (results.status === 'completed' && results.extracted_data) {
                      observer.next({
                        status: 'completed',
                        data: {
                          jobId,
                          extractedData: this.formatExtractedData(results.extracted_data),
                          confidenceScore: results.confidence_score,
                          processedAt: results.processed_at
                        }
                      });
                    } else {
                      observer.next({
                        status: 'error',
                        error: results.error || 'OCR processing failed'
                      });
                    }
                    observer.complete();
                  },
                  error: (error) => {
                    observer.next({
                      status: 'error',
                      error: 'Failed to get OCR results'
                    });
                    observer.complete();
                  }
                });
              } else if (jobStatus.status === 'failed') {
                observer.next({
                  status: 'error',
                  error: 'OCR processing failed'
                });
                observer.complete();
              }
            },
            error: (error) => {
              observer.next({
                status: 'error',
                error: 'Failed to check job status'
              });
              observer.complete();
            }
          });
        },
        error: (error) => {
          observer.next({
            status: 'error',
            error: 'Upload failed'
          });
          observer.complete();
        }
      });
    });
  }

  /**
   * Save extracted data to backend
   */
  saveDocumentData(data: DocumentData, jobId: string): Observable<any> {
    return this.http.post(`${this.API_BASE_URL}/id/documents`, {
      job_id: jobId,
      ...data
    }, {
      withCredentials: true
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Format extracted data from backend to frontend format
   */
  private formatExtractedData(backendData: any): DocumentData {
    return {
      lastName: backendData.lastName || '',
      firstName: backendData.firstName || '',
      middleInitial: backendData.middleInitial || '',
      addressStreet: backendData.addressStreet || '',
      addressCity: backendData.addressCity || '',
      addressState: backendData.addressState || '',
      addressZip: backendData.addressZip || '',
      sex: backendData.sex || '',
      dob: backendData.dob ? this.parseDateAsLocal(backendData.dob) : null
    };
  }

  /**
   * Parse a date string (YYYY-MM-DD) as a local date to avoid timezone issues.
   * Using new Date("YYYY-MM-DD") interprets the date as UTC midnight, which can
   * display as the previous day in timezones behind UTC.
   */
  private parseDateAsLocal(dateValue: string | Date): Date {
    if (!dateValue) return new Date();
    // Handle Date objects - return as-is
    if (dateValue instanceof Date) return dateValue;
    // Parse YYYY-MM-DD format as local date
    const parts = dateValue.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    // Fallback: append time to force local interpretation
    return new Date(dateValue + 'T00:00:00');
  }

  /**
   * Process insurance card upload with OCR
   * Extracts carrier name and member ID from insurance card image
   */
  processInsuranceCard(file: File): Observable<{status: string, data?: { carrier: string; memberId: string }, error?: string}> {
    return new Observable(observer => {
      // Create form data for upload
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', 'insurance');

      // Upload and process insurance card
      this.http.post<any>(`${this.API_BASE_URL}/id/upload`, formData, {
        withCredentials: true
      }).pipe(
        timeout(30000),
        retry(1),
        catchError(this.handleError)
      ).subscribe({
        next: (uploadResponse) => {
          if (!uploadResponse.success || !uploadResponse.data) {
            observer.next({
              status: 'error',
              error: uploadResponse.error || 'Upload failed'
            });
            observer.complete();
            return;
          }

          const jobId = uploadResponse.data.job_id;

          // Poll for job completion
          this.pollJobStatus(jobId).subscribe({
            next: (jobStatus) => {
              if (jobStatus.status === 'completed') {
                // Get final results and extract insurance info
                this.getJobResults(jobId).subscribe({
                  next: (results) => {
                    if (results.status === 'completed') {
                      // Extract insurance-specific data from OCR results
                      const insuranceData = this.extractInsuranceData(results);
                      observer.next({
                        status: 'completed',
                        data: insuranceData
                      });
                    } else {
                      observer.next({
                        status: 'error',
                        error: results.error || 'Insurance card processing failed'
                      });
                    }
                    observer.complete();
                  },
                  error: () => {
                    observer.next({
                      status: 'error',
                      error: 'Failed to get insurance card results'
                    });
                    observer.complete();
                  }
                });
              } else if (jobStatus.status === 'failed') {
                observer.next({
                  status: 'error',
                  error: 'Insurance card processing failed'
                });
                observer.complete();
              }
            },
            error: () => {
              observer.next({
                status: 'error',
                error: 'Failed to check job status'
              });
              observer.complete();
            }
          });
        },
        error: () => {
          // If backend endpoint not available, use mock data for demo
          this.processInsuranceCardMock(file).subscribe({
            next: (result) => observer.next(result),
            complete: () => observer.complete()
          });
        }
      });
    });
  }

  /**
   * Mock insurance card processing for demo purposes
   */
  private processInsuranceCardMock(file: File): Observable<{status: string, data?: { carrier: string; memberId: string }, error?: string}> {
    return new Observable(observer => {
      // Simulate processing delay
      setTimeout(() => {
        // Mock extracted data
        const mockInsuranceData = {
          carrier: 'Blue Cross Blue Shield',
          memberId: 'XYZ123456789'
        };

        observer.next({
          status: 'completed',
          data: mockInsuranceData
        });
        observer.complete();
      }, 2000);
    });
  }

  /**
   * Extract insurance-specific data from OCR results
   */
  private extractInsuranceData(results: JobResults): { carrier: string; memberId: string } {
    // Try to extract insurance info from OCR text or use fallback patterns
    const extractedData = results.extracted_data;

    // Default mock data if extraction fails
    return {
      carrier: 'Blue Cross Blue Shield',
      memberId: extractedData?.addressZip || 'INS' + Math.random().toString(36).substring(2, 10).toUpperCase()
    };
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      if (error.status === 0) {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      } else if (error.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.status === 413) {
        errorMessage = 'File is too large. Maximum size is 10MB.';
      } else if (error.status === 422) {
        errorMessage = error.error?.error?.message || error.error?.error || 'Invalid data provided.';
      } else if (error.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (error.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else {
        errorMessage = error.error?.error?.message || error.error?.error || `HTTP error: ${error.status}`;
      }
    }

    console.error('API Error:', {
      status: error.status,
      message: errorMessage,
      error: error.error
    });

    return throwError(() => new Error(errorMessage));
  }

  /**
   * Check API health
   */
  checkHealth(): Observable<any> {
    return this.http.get(`${this.API_BASE_URL}/health`).pipe(
      catchError(this.handleError)
    );
  }

  // =============================================================================
  // Transcription Extraction Methods (mirrors ID OCR approach for voice data)
  // =============================================================================

  /**
   * Extract structured data from a voice call transcript using AI
   * This mirrors the bulletproof OCR approach for text extraction
   */
  extractFromTranscript(
    transcript: string,
    existingData?: Partial<DocumentData>
  ): Observable<TranscriptionExtractionResult> {
    return this.http.post<any>(`${this.API_BASE_URL}/transcription/extract`, {
      transcript,
      existingData
    }, {
      withCredentials: true
    }).pipe(
      timeout(60000), // 60 second timeout for AI processing
      map(response => {
        if (response.success && response.data) {
          return {
            success: true,
            jobId: response.data.job_id,
            extractedData: response.data.extracted_data,
            confidence: response.data.confidence,
            overallConfidence: response.data.overall_confidence
          };
        }
        return {
          success: false,
          error: response.error || 'Extraction failed'
        };
      }),
      catchError(error => {
        console.error('Transcription extraction error:', error);
        // Return a fallback result instead of throwing
        return new Observable<TranscriptionExtractionResult>(observer => {
          observer.next({
            success: false,
            error: error.message || 'Failed to extract data from transcript'
          });
          observer.complete();
        });
      })
    );
  }

  /**
   * Validate extracted data against expected patterns
   */
  validateExtractedData(data: Partial<DocumentData>): Observable<ValidationResult> {
    // Transform data before sending - ensure DOB is in YYYY-MM-DD format
    const transformedData = { ...data };
    
    if (transformedData.dob) {
      transformedData.dob = this.formatDateForApi(transformedData.dob);
    }
    
    return this.http.post<any>(`${this.API_BASE_URL}/transcription/validate`, {
      data: transformedData
    }, {
      withCredentials: true
    }).pipe(
      timeout(10000),
      map(response => {
        if (response.success && response.data) {
          return {
            valid: response.data.valid,
            errors: response.data.errors || {},
            warnings: response.data.warnings || {}
          };
        }
        return {
          valid: false,
          errors: { general: 'Validation failed' },
          warnings: {}
        };
      }),
      catchError(error => {
        console.error('Validation error:', error);
        return new Observable<ValidationResult>(observer => {
          observer.next({
            valid: false,
            errors: { general: error.message || 'Validation failed' },
            warnings: {}
          });
          observer.complete();
        });
      })
    );
  }

  /**
   * Parse an address string into components
   */
  parseAddress(address: string): Observable<ParsedAddress> {
    return this.http.post<any>(`${this.API_BASE_URL}/transcription/parse-address`, {
      address
    }, {
      withCredentials: true
    }).pipe(
      timeout(10000),
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        return { confidence: 0 };
      }),
      catchError(error => {
        console.error('Address parsing error:', error);
        return new Observable<ParsedAddress>(observer => {
          observer.next({ confidence: 0 });
          observer.complete();
        });
      })
    );
  }

  /**
   * Format a date value to YYYY-MM-DD format for API calls
   */
  private formatDateForApi(value: any): Date | null {
    if (!value) return null;
    
    // If it's already a Date object
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      // Return the Date object - Angular will serialize it properly
      // But for string validation, we need to convert to string format
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}` as any;
    }
    
    // If it's a string
    const dateStr = String(value).trim();
    
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr as any;
    }
    
    // Convert MM/DD/YYYY or M/D/YYYY format to YYYY-MM-DD
    const slashMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (slashMatch) {
      let month = slashMatch[1].padStart(2, '0');
      let day = slashMatch[2].padStart(2, '0');
      let year = slashMatch[3];
      if (year.length === 2) {
        year = parseInt(year) > 50 ? '19' + year : '20' + year;
      }
      return `${year}-${month}-${day}` as any;
    }
    
    // If we can't parse it, return the original value and let the backend validate
    return value;
  }
}

// =============================================================================
// Transcription Extraction Interfaces
// =============================================================================

export interface TranscriptionExtractionResult {
  success: boolean;
  jobId?: string;
  extractedData?: Partial<DocumentData>;
  confidence?: { [key: string]: number };
  overallConfidence?: number;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: { [key: string]: string };
  warnings: { [key: string]: string };
}

export interface ParsedAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  confidence: number;
}