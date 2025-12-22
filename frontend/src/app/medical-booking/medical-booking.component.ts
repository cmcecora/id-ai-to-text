import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  trigger,
  state,
  style,
  animate,
  transition,
  query,
  group
} from '@angular/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService, DocumentData } from '../services/api.service';

interface MedicalTest {
  id: string;
  name: string;
  description: string;
  resultsTime: string;
  price: number;
  icon: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  distance: string;
}

interface CalendarDay {
  date: number;
  available: boolean;
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
}

@Component({
  selector: 'app-medical-booking',
  templateUrl: './medical-booking.component.html',
  styleUrls: ['./medical-booking.component.scss'],
  animations: [
    // Step transition animation
    trigger('stepTransition', [
      // Enter from right (for forward navigation)
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateX(30px)'
        }),
        animate('300ms ease-out', style({
          opacity: 1,
          transform: 'translateX(0)'
        }))
      ]),
      // Leave with fade out
      transition(':leave', [
        animate('200ms ease-in', style({
          opacity: 0,
          transform: 'translateX(-20px)'
        }))
      ])
    ]),

    // Reverse transition for going back
    trigger('stepTransitionReverse', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateX(-30px)'
        }),
        animate('300ms ease-out', style({
          opacity: 1,
          transform: 'translateX(0)'
        }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({
          opacity: 0,
          transform: 'translateX(20px)'
        }))
      ])
    ]),

    // Fade in animation for confirmation
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ]),

    // Slide animation with direction parameter
    trigger('slideAnimation', [
      transition('* => forward', [
        style({ opacity: 0, transform: 'translateX(40px)' }),
        animate('350ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition('* => backward', [
        style({ opacity: 0, transform: 'translateX(-40px)' }),
        animate('350ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition('* => initial', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class MedicalBookingComponent implements OnInit {
  currentStep = 1;
  totalSteps = 5;
  animationDirection: 'forward' | 'backward' | 'initial' = 'initial';
  isAnimating = false;

  // Step 1: Test Selection
  selectedTest: MedicalTest | null = null;
  medicalTests: MedicalTest[] = [
    { id: 'cbc', name: 'Complete Blood Count (CBC)', description: 'Comprehensive blood cell analysis', resultsTime: '24 hours', price: 29, icon: 'favorite' },
    { id: 'cmp', name: 'Complete Metabolic Panel (CMP)', description: '14 blood tests for metabolism', resultsTime: '24 hours', price: 45, icon: 'science' },
    { id: 'thyroid-full', name: 'Comprehensive Thyroid Panel', description: 'TSH, T3, T4, and antibodies', resultsTime: '48 hours', price: 89, icon: 'monitor_heart' },
    { id: 'lipid', name: 'Lipid Panel', description: 'Cholesterol and triglycerides', resultsTime: '24 hours', price: 35, icon: 'favorite' },
    { id: 'a1c', name: 'Hemoglobin A1C', description: 'Blood sugar average over 3 months', resultsTime: '24 hours', price: 32, icon: 'water_drop' },
    { id: 'vitd', name: 'Vitamin D, 25-Hydroxy', description: 'Vitamin D deficiency screening', resultsTime: '48 hours', price: 55, icon: 'wb_sunny' },
    { id: 'tsh', name: 'Thyroid Stimulating Hormone (TSH)', description: 'Basic thyroid function test', resultsTime: '24 hours', price: 35, icon: 'monitor_heart' },
    { id: 'xray', name: 'Chest X-Ray', description: 'Standard chest radiograph', resultsTime: '2-4 hours', price: 75, icon: 'image' },
    { id: 'mri', name: 'MRI Brain', description: 'Detailed brain imaging', resultsTime: '24-48 hours', price: 450, icon: 'image' },
    { id: 'ct', name: 'CT Scan Abdomen', description: 'Abdominal computed tomography', resultsTime: '24 hours', price: 350, icon: 'image' },
    { id: 'ecg', name: 'Electrocardiogram (ECG/EKG)', description: 'Heart electrical activity', resultsTime: '1 hour', price: 50, icon: 'favorite' },
    { id: 'echo', name: 'Echocardiogram', description: 'Heart ultrasound imaging', resultsTime: '24 hours', price: 180, icon: 'favorite' },
    { id: 'testosterone', name: 'Testosterone, Total', description: 'Male hormone level test', resultsTime: '48 hours', price: 65, icon: 'science' },
    { id: 'estrogen', name: 'Estrogen Panel', description: 'Female hormone levels', resultsTime: '48 hours', price: 85, icon: 'science' },
    { id: 'genetic', name: 'Genetic Carrier Screening', description: 'Hereditary condition testing', resultsTime: '2-3 weeks', price: 299, icon: 'biotech' },
    { id: 'brca', name: 'BRCA Gene Testing', description: 'Breast cancer gene analysis', resultsTime: '2-3 weeks', price: 399, icon: 'biotech' },
    { id: 'food-allergy', name: 'Food Allergy Panel', description: 'Common food allergen test', resultsTime: '5-7 days', price: 189, icon: 'restaurant' },
    { id: 'resp-allergy', name: 'Respiratory Allergy Panel', description: 'Airborne allergen screening', resultsTime: '5-7 days', price: 169, icon: 'air' },
    { id: 'psa', name: 'Prostate Specific Antigen (PSA)', description: 'Prostate health screening', resultsTime: '24 hours', price: 45, icon: 'science' },
    { id: 'liver', name: 'Liver Function Panel', description: 'Hepatic health assessment', resultsTime: '24 hours', price: 42, icon: 'science' },
    { id: 'glucose', name: 'Blood Glucose Test', description: 'Fasting blood sugar level', resultsTime: '12 hours', price: 25, icon: 'water_drop' },
    { id: 'metabolic', name: 'Basic Metabolic Panel', description: 'Kidney function and electrolytes', resultsTime: '24 hours', price: 50, icon: 'biotech' }
  ];

  // Step 2: Date/Time Selection
  currentMonth: Date = new Date();
  selectedDate: Date | null = null;
  selectedTime: string | null = null;
  selectedLocation: Location | null = null;

  calendarDays: CalendarDay[] = [];
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  morningSlots: TimeSlot[] = [
    { time: '8:00 AM', available: true },
    { time: '8:30 AM', available: true },
    { time: '9:00 AM', available: true },
    { time: '9:30 AM', available: true },
    { time: '10:00 AM', available: false },
    { time: '10:30 AM', available: true }
  ];

  afternoonSlots: TimeSlot[] = [
    { time: '12:00 PM', available: true },
    { time: '12:30 PM', available: true },
    { time: '1:00 PM', available: true },
    { time: '1:30 PM', available: false },
    { time: '2:00 PM', available: true },
    { time: '2:30 PM', available: true }
  ];

  eveningSlots: TimeSlot[] = [
    { time: '4:00 PM', available: true },
    { time: '4:30 PM', available: true },
    { time: '5:00 PM', available: true }
  ];

  locations: Location[] = [
    {
      id: 'downtown',
      name: 'Downtown Medical Center',
      address: '123 Healthcare Ave, Suite 200',
      city: 'New York, NY 10001',
      distance: '0.5 miles away'
    },
    {
      id: 'westside',
      name: 'Westside Diagnostics',
      address: '456 Wellness Blvd, Floor 3',
      city: 'New York, NY 10023',
      distance: '2.1 miles away'
    }
  ];

  // Step 3: ID Upload (NEW)
  ocrData: DocumentData | null = null;
  isProcessingOcr = false;
  ocrProgress = 0;
  uploadSkipped = false;
  currentJobId: string | null = null;
  ocrError: string | null = null;

  // Step 4: Patient Details Form
  patientForm!: FormGroup;

  // Step 5: Confirmation
  bookingConfirmed = false;
  confirmationNumber = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.generateCalendar();
    this.initPatientForm();
    this.selectedLocation = this.locations[0];

    // Handle pre-selected test from search page
    this.route.queryParams.subscribe(params => {
      if (params['testId']) {
        const test = this.medicalTests.find(t => t.id === params['testId']);
        if (test) {
          this.selectedTest = test;
          // Skip to step 2 if test was pre-selected
          this.currentStep = 2;
          this.animationDirection = 'initial';
        }
      }
    });
  }

  initPatientForm(): void {
    this.patientForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\(\d{3}\) \d{3}-\d{4}$/)]],
      dob: ['', Validators.required],
      insuranceProvider: [''],
      memberId: [''],
      notes: ['']
    });
  }

  generateCalendar(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDayOfMonth.getDay();

    this.calendarDays = [];

    // Add empty days for the start of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      this.calendarDays.push({
        date: 0,
        available: false,
        isToday: false,
        isSelected: false,
        isPast: true
      });
    }

    // Add days of the month
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const currentDate = new Date(year, month, day);
      currentDate.setHours(0, 0, 0, 0);
      const isPast = currentDate < today;
      const isToday = currentDate.getTime() === today.getTime();
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      const isSelected = this.selectedDate?.getTime() === currentDate.getTime();

      this.calendarDays.push({
        date: day,
        available: !isPast && !isWeekend,
        isToday,
        isSelected,
        isPast
      });
    }
  }

  previousMonth(): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() - 1,
      1
    );
    this.generateCalendar();
  }

  nextMonth(): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() + 1,
      1
    );
    this.generateCalendar();
  }

  get currentMonthName(): string {
    return this.currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  selectDate(day: CalendarDay): void {
    if (!day.available || day.date === 0) return;

    this.selectedDate = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth(),
      day.date
    );
    this.generateCalendar();
  }

  get formattedSelectedDate(): string {
    if (!this.selectedDate) return '';
    return this.selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  get shortFormattedDate(): string {
    if (!this.selectedDate) return '';
    return this.selectedDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  selectTime(time: string): void {
    this.selectedTime = time;
  }

  selectLocation(location: Location): void {
    this.selectedLocation = location;
  }

  selectTest(test: MedicalTest): void {
    this.selectedTest = test;
  }

  // Navigation
  canProceed(): boolean {
    switch (this.currentStep) {
      case 1:
        return this.selectedTest !== null;
      case 2:
        return this.selectedDate !== null && this.selectedTime !== null && this.selectedLocation !== null;
      case 3:
        // Step 3 (ID Upload) - Can proceed unless currently processing OCR
        return !this.isProcessingOcr;
      case 4:
        return this.patientForm.valid;
      case 5:
        return true;
      default:
        return false;
    }
  }

  nextStep(): void {
    if (this.canProceed() && this.currentStep < this.totalSteps && !this.isAnimating) {
      this.isAnimating = true;
      this.animationDirection = 'forward';

      // Small delay to allow animation to register
      setTimeout(() => {
        this.currentStep++;
        this.isAnimating = false;

        // Pre-fill patient form when entering Step 4 if OCR data exists
        if (this.currentStep === 4 && this.ocrData && !this.uploadSkipped) {
          this.prefillPatientForm();
        }

        // Confirm booking when entering Step 5
        if (this.currentStep === 5) {
          this.confirmBooking();
        }
      }, 50);
    }
  }

  previousStep(): void {
    if (this.currentStep > 1 && !this.isAnimating) {
      this.isAnimating = true;
      this.animationDirection = 'backward';

      setTimeout(() => {
        this.currentStep--;
        this.isAnimating = false;
      }, 50);
    }
  }

  goToStep(step: number): void {
    if (step < this.currentStep && !this.isAnimating) {
      this.isAnimating = true;
      this.animationDirection = 'backward';

      setTimeout(() => {
        this.currentStep = step;
        this.isAnimating = false;
      }, 50);
    }
  }

  // Animation callback to track animation state
  onAnimationDone(): void {
    this.isAnimating = false;
  }

  confirmBooking(): void {
    // Generate a confirmation number
    this.confirmationNumber = 'MED-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    this.bookingConfirmed = true;
  }

  startNewBooking(): void {
    this.animationDirection = 'backward';
    this.isAnimating = true;

    setTimeout(() => {
      this.currentStep = 1;
      this.selectedTest = null;
      this.selectedDate = null;
      this.selectedTime = null;
      this.selectedLocation = this.locations[0];
      this.patientForm.reset();
      this.bookingConfirmed = false;
      this.confirmationNumber = '';
      this.generateCalendar();

      // Reset ID upload state
      this.ocrData = null;
      this.isProcessingOcr = false;
      this.ocrProgress = 0;
      this.uploadSkipped = false;
      this.currentJobId = null;
      this.ocrError = null;

      this.isAnimating = false;
      this.animationDirection = 'initial';
    }, 50);
  }

  // Phone number formatting
  formatPhoneNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');

    if (value.length > 10) {
      value = value.slice(0, 10);
    }

    if (value.length >= 6) {
      value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
    } else if (value.length >= 3) {
      value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }

    this.patientForm.patchValue({ phone: value });
  }

  // ===========================
  // Step 3: ID Upload Methods
  // ===========================

  /**
   * Handle file upload from upload-panel component
   */
  onFileProcessed(file: File): void {
    this.processDocument(file);
  }

  /**
   * Process uploaded document through OCR
   */
  private processDocument(file: File): void {
    this.isProcessingOcr = true;
    this.ocrProgress = 0;
    this.ocrData = null;
    this.ocrError = null;
    this.uploadSkipped = false;

    this.apiService.processDocument(file).subscribe({
      next: (response) => {
        switch (response.status) {
          case 'uploading':
            this.ocrProgress = 10;
            this.currentJobId = response.data?.jobId || null;
            break;

          case 'processing':
            this.ocrProgress = 20 + ((response.data?.progress || 0) * 0.6);
            break;

          case 'completed':
            this.ocrProgress = 100;
            this.isProcessingOcr = false;
            this.ocrData = response.data?.extractedData || null;
            this.currentJobId = response.data?.jobId || null;
            this.snackBar.open(
              'ID processed successfully! Your information has been extracted.',
              'Close',
              {
                duration: 4000,
                horizontalPosition: 'center',
                verticalPosition: 'top'
              }
            );
            break;

          case 'error':
            this.isProcessingOcr = false;
            this.ocrProgress = 0;
            this.ocrError = response.error || 'Failed to process ID document';
            this.snackBar.open(
              this.ocrError,
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
        this.isProcessingOcr = false;
        this.ocrProgress = 0;
        this.ocrError = error.message || 'Failed to process document';
        this.snackBar.open(
          'Failed to process ID: ' + this.ocrError,
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

  /**
   * Skip ID upload and proceed with manual entry
   */
  skipIdUpload(): void {
    this.uploadSkipped = true;
    this.ocrData = null;
    this.ocrError = null;
    this.nextStep();
  }

  /**
   * Retry OCR processing after an error
   */
  retryUpload(): void {
    this.ocrError = null;
    this.ocrData = null;
  }

  /**
   * Clear current upload and allow new upload
   */
  clearUpload(): void {
    this.ocrData = null;
    this.ocrError = null;
    this.currentJobId = null;
    this.ocrProgress = 0;
    this.uploadSkipped = false;
  }

  /**
   * Pre-fill patient form with OCR extracted data
   */
  private prefillPatientForm(): void {
    if (!this.ocrData) return;

    // Map OCR data to patient form fields
    const formUpdates: { [key: string]: any } = {};

    if (this.ocrData.firstName) {
      formUpdates['firstName'] = this.ocrData.firstName;
    }
    if (this.ocrData.lastName) {
      formUpdates['lastName'] = this.ocrData.lastName;
    }
    if (this.ocrData.dob) {
      // Parse date string to Date object for the datepicker
      formUpdates['dob'] = new Date(this.ocrData.dob);
    }

    // Patch form with extracted values
    this.patientForm.patchValue(formUpdates);

    // Show success message about pre-fill
    this.snackBar.open(
      'Form pre-filled with your ID information. Please verify and complete.',
      'OK',
      {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      }
    );
  }
}
