import { Component, OnInit, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

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

@Component({
  selector: 'app-data-form',
  templateUrl: './data-form.component.html',
  styleUrls: ['./data-form.component.scss']
})
export class DataFormComponent implements OnInit, OnChanges {
  @Input() ocrData: DocumentData | null = null;
  @Input() isProcessing: boolean = false;
  @Output() formSave = new EventEmitter<DocumentData>();
  @Output() formEdit = new EventEmitter<void>();

  documentForm: FormGroup;
  isFormLocked: boolean = false;
  isSaving: boolean = false;

  // Form states
  sexOptions = ['M', 'F', 'Other'];
  stateOptions = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.documentForm = this.createForm();
  }

  ngOnInit(): void {
    this.setupFormValueChanges();
  }

  ngOnChanges(): void {
    if (this.ocrData) {
      this.populateForm(this.ocrData);
      this.lockForm();
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      middleInitial: ['', Validators.maxLength(1)],
      addressStreet: ['', Validators.required],
      addressCity: ['', Validators.required],
      addressState: ['', Validators.required],
      addressZip: ['', [Validators.required, Validators.pattern(/^\d{5}(-\d{4})?$/)]],
      sex: ['', Validators.required],
      dob: [null, [Validators.required, this.dateOfBirthValidator]]
    });
  }

  private dateOfBirthValidator(control: FormControl): { [key: string]: any } | null {
    const value = control.value;
    if (!value) {
      return null;
    }

    const today = new Date();
    const birthDate = new Date(value);

    // Check if date is not in the future
    if (birthDate > today) {
      return { futureDate: true };
    }

    // Check if person is not too old (reasonable limit: 120 years)
    const maxAge = 120;
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - maxAge);

    if (birthDate < minDate) {
      return { tooOld: true };
    }

    // Check if person is not too young (reasonable limit: 1 year)
    const minAge = 1;
    const recentDate = new Date();
    recentDate.setFullYear(recentDate.getFullYear() - minAge);

    if (birthDate > recentDate) {
      return { tooYoung: true };
    }

    return null;
  }

  private setupFormValueChanges(): void {
    // Enable/disable save button based on form validity
    this.documentForm.statusChanges.subscribe(() => {
      // Form validity changes are handled by template
    });
  }

  private populateForm(data: DocumentData): void {
    this.documentForm.patchValue({
      lastName: data.lastName || '',
      firstName: data.firstName || '',
      middleInitial: data.middleInitial || '',
      addressStreet: data.addressStreet || '',
      addressCity: data.addressCity || '',
      addressState: data.addressState || '',
      addressZip: data.addressZip || '',
      sex: data.sex || '',
      dob: data.dob ? new Date(data.dob) : null
    });
  }

  private lockForm(): void {
    this.isFormLocked = true;
    this.documentForm.disable();
  }

  private unlockForm(): void {
    this.isFormLocked = false;
    this.documentForm.enable();
  }

  onSave(): void {
    if (this.documentForm.invalid) {
      this.snackBar.open('Please fix all validation errors before saving.', 'Close', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    const formData: DocumentData = {
      ...this.documentForm.value,
      dob: this.documentForm.get('dob')?.value
    };

    this.isSaving = true;

    // Simulate API call or actual save operation
    setTimeout(() => {
      this.formSave.emit(formData);
      this.lockForm();
      this.isSaving = false;

      this.snackBar.open('Document information saved successfully!', 'Close', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    }, 1000);
  }

  onEdit(): void {
    this.unlockForm();
    this.formEdit.emit();
  }

  onClear(): void {
    this.documentForm.reset();
    this.unlockForm();
    this.formEdit.emit();
  }

  // Helper methods for form validation
  getErrorMessage(field: string): string {
    const control = this.documentForm.get(field);
    if (!control || !control.errors) {
      return '';
    }

    const errors = control.errors;

    if (errors['required']) {
      return 'This field is required';
    }

    if (errors['minlength']) {
      return `Minimum length is ${errors['minlength'].requiredLength} characters`;
    }

    if (errors['maxlength']) {
      return `Maximum length is ${errors['maxlength'].requiredLength} characters`;
    }

    if (errors['pattern']) {
      if (field === 'addressZip') {
        return 'Please enter a valid ZIP code (12345 or 12345-6789)';
      }
      return 'Invalid format';
    }

    if (field === 'dob') {
      if (errors['futureDate']) {
        return 'Date of birth cannot be in the future';
      }
      if (errors['tooOld']) {
        return 'Please enter a valid date of birth';
      }
      if (errors['tooYoung']) {
        return 'Please enter a valid date of birth';
      }
    }

    return 'Invalid input';
  }

  isFieldValid(field: string): boolean {
    const control = this.documentForm.get(field);
    return control ? control.valid && (control.dirty || control.touched) : false;
  }

  isFieldInvalid(field: string): boolean {
    const control = this.documentForm.get(field);
    return control ? control.invalid && (control.dirty || control.touched) : false;
  }

  getFormStatusMessage(): string {
    if (this.isProcessing) {
      return 'Processing document with OCR...';
    }

    if (!this.ocrData) {
      return 'Please upload a document to begin OCR processing';
    }

    if (this.isFormLocked) {
      return 'Form is locked. Click Edit to modify or Save to confirm.';
    }

    return 'Please review and edit the extracted information';
  }
}