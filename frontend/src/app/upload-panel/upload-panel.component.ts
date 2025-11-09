import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ImageCompressService } from 'ngx-image-compress';

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
  isCompressing = false;
  fileSizeExceeded = false;

  // Accepted file types
  acceptedTypes = ['.jpg', '.jpeg', '.png', '.pdf', '.heic'];
  maxFileSize = 10 * 1024 * 1024; // 10MB
  compressionThreshold = 5 * 1024 * 1024; // 5MB

  constructor(
    private snackBar: MatSnackBar,
    private imageCompress: ImageCompressService
  ) { }

  ngOnInit(): void {
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
  }

  private async generatePreview(file: File): Promise<void> {
    if (file.type === 'application/pdf') {
      // For PDF files, we'll show a PDF preview icon in the template instead
      this.previewUrl = null;
    } else if (file.type === 'image/heic') {
      // Convert HEIC to JPEG for preview
      try {
        this.isCompressing = true;
        const compressedFile = await this.compressImage(file);
        this.previewUrl = URL.createObjectURL(compressedFile);
      } catch (error) {
        console.error('Error converting HEIC file:', error);
        this.snackBar.open('Error converting HEIC file.', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      } finally {
        this.isCompressing = false;
      }
    } else {
      // For regular images
      this.previewUrl = URL.createObjectURL(file);
    }
  }

  private async compressImage(file: File): Promise<File> {
    if (file.type === 'image/heic') {
      // For HEIC files, convert to JPEG first
      const reader = new FileReader();
      const imageBlob = await new Promise<Blob>((resolve, reject) => {
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to convert HEIC'));
              }, 'image/jpeg', 0.8);
            }
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      });

      return new File([imageBlob], file.name.replace('.heic', '.jpg'), {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
    } else if (file.size > this.compressionThreshold) {
      // Compress large images
      this.isCompressing = true;
      try {
        const compressedImage = await this.imageCompress.compressFile(file, -1, 50, 50);
        const compressedBlob = this.dataURLtoFile(compressedImage, file.name);
        return compressedBlob;
      } finally {
        this.isCompressing = false;
      }
    }

    return file;
  }

  private dataURLtoFile(dataURL: string, filename: string): File {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
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

      // Compress image if needed
      const fileToUpload = await this.compressImage(this.selectedFile);

      // Emit the processed file for parent component
      this.fileProcessed.emit(fileToUpload);

      this.snackBar.open('File uploaded successfully!', 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });

    } catch (error) {
      console.error('Upload error:', error);
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