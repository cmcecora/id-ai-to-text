import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-upload-panel',
  templateUrl: './upload-panel.component.html',
  styleUrls: ['./upload-panel.component.scss']
})
export class UploadPanelComponent implements OnInit {
  @Output() fileProcessed = new EventEmitter<File>();
  @Input() disabled: boolean = false;

  selectedFile: File | null = null;
  previewUrl: string | null = null;
  isUploading = false;
  uploadSuccess = false;
  fileSizeExceeded = false;
  isDragOver = false;

  // Accepted file types
  acceptedTypes = ['.jpg', '.jpeg', '.png', '.pdf', '.heic'];
  maxFileSize = 10 * 1024 * 1024; // 10MB

  constructor(
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (this.disabled || this.isUploading) {
      return;
    }

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  private handleFile(file: File): void {
    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!this.acceptedTypes.includes(fileExtension)) {
      this.snackBar.open('Invalid file type. Please upload JPG, PNG, PDF, or HEIC files.', 'Close', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    // Validate file size
    if (file.size > this.maxFileSize) {
      this.fileSizeExceeded = true;
      this.selectedFile = file;
      this.snackBar.open('File size exceeds 10MB limit.', 'Close', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    this.fileSizeExceeded = false;
    this.selectedFile = file;
    this.generatePreview(file);

    // Auto-upload after a short delay
    setTimeout(() => {
      if (this.selectedFile && !this.fileSizeExceeded && !this.disabled) {
        this.uploadFile();
      }
    }, 500);
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!this.acceptedTypes.includes(fileExtension)) {
      this.snackBar.open('Invalid file type. Please upload JPG, PNG, PDF, or HEIC files.', 'Close', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    // Validate file size
    if (file.size > this.maxFileSize) {
      this.fileSizeExceeded = true;
      this.snackBar.open('File size exceeds 10MB limit.', 'Close', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    this.fileSizeExceeded = false;
    this.selectedFile = file;
    this.generatePreview(file);

    // Auto-upload after a short delay (like React version)
    setTimeout(() => {
      if (this.selectedFile && !this.fileSizeExceeded && !this.disabled) {
        this.uploadFile();
      }
    }, 500);
  }

  private async generatePreview(file: File): Promise<void> {
    if (file.type === 'application/pdf') {
      // For PDF files, we'll show a PDF preview icon in the template instead
      this.previewUrl = null;
    } else if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
      // HEIC files will be converted by the server - show a placeholder
      this.previewUrl = null;
      this.snackBar.open('HEIC file selected. Server will convert to JPEG.', 'OK', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    } else {
      // For regular images (JPG, PNG) - use FileReader for reliable preview
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.previewUrl = e.target?.result as string;
      };
      reader.onerror = () => {
        this.snackBar.open('Failed to preview image', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        this.previewUrl = null;
      };
      reader.readAsDataURL(file);
    }
  }


  async uploadFile(): Promise<void> {
    if (!this.selectedFile) {
      this.snackBar.open('Please select a file first.', 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    try {
      this.isUploading = true;

      // Emit the file for parent component (server will handle all processing)
      this.fileProcessed.emit(this.selectedFile);

      // Set success state
      this.uploadSuccess = true;

      this.snackBar.open('File uploaded successfully!', 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });

    } catch (error) {
      console.error('Upload error:', error);
      this.uploadSuccess = false;
      this.snackBar.open('Upload failed. Please try again.', 'Close', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    } finally {
      this.isUploading = false;
    }
  }

  clearFile(): void {
    this.selectedFile = null;
    this.previewUrl = null;
    this.uploadSuccess = false;
    this.fileSizeExceeded = false;

    // Clear file input
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}