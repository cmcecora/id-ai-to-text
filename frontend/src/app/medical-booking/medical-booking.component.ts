import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
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
  category: string;
  resultsTime: string;
  price: number;
  icon: string;
}

interface RecentSearch {
  name: string;
  searchedAgo: string;
}

interface TestCategory {
  id: string;
  name: string;
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
    ]),

    // Dropdown animation for autocomplete
    trigger('dropdownAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-8px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-8px)' }))
      ])
    ]),

    // Collapse animation for date-time section
    trigger('collapseAnimation', [
      state('expanded', style({
        height: '*',
        opacity: 1,
        overflow: 'visible'
      })),
      state('collapsed', style({
        height: '0px',
        opacity: 0,
        overflow: 'hidden'
      })),
      transition('expanded => collapsed', [
        style({ overflow: 'hidden' }),
        animate('350ms cubic-bezier(0.4, 0, 0.2, 1)')
      ]),
      transition('collapsed => expanded', [
        animate('350ms cubic-bezier(0.4, 0, 0.2, 1)'),
        style({ overflow: 'visible' })
      ])
    ]),

    // Slide in animation for collapsed info bar
    trigger('slideInBar', [
      transition(':enter', [
        style({ opacity: 0, height: '0px', transform: 'translateY(-10px)' }),
        animate('350ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, height: '*', transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('250ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, height: '0px', transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class MedicalBookingComponent implements OnInit {
  @ViewChild('testSearchInput') testSearchInputRef!: ElementRef;
  @ViewChild('locationSection') locationSectionRef!: ElementRef;

  currentStep = 1;
  totalSteps = 6;
  animationDirection: 'forward' | 'backward' | 'initial' = 'initial';
  isAnimating = false;

  // Step 1: Test Selection & Search
  testSearchQuery = '';
  isTestDropdownOpen = false;
  isTestSearchLoading = false;
  filteredTests: MedicalTest[] = [];
  testHighlightedIndex = -1;

  // Categories for quick browse
  testCategories: TestCategory[] = [
    { id: 'blood', name: 'Blood Tests', icon: 'water_drop' },
    { id: 'imaging', name: 'Imaging', icon: 'image' },
    { id: 'cardiac', name: 'Cardiac', icon: 'favorite' },
    { id: 'hormone', name: 'Hormones', icon: 'monitor_heart' },
    { id: 'genetic', name: 'Genetic', icon: 'biotech' }
  ];

  // Recent searches
  recentSearches: RecentSearch[] = [
    { name: 'Complete Blood Count (CBC)', searchedAgo: '2 days ago' },
    { name: 'Lipid Panel', searchedAgo: '1 week ago' }
  ];

  selectedTest: MedicalTest | null = null;
  medicalTests: MedicalTest[] = [
    { id: 'cbc', name: 'Complete Blood Count (CBC)', description: 'Comprehensive blood cell analysis', category: 'blood', resultsTime: '24 hours', price: 29, icon: 'favorite' },
    { id: 'cmp', name: 'Complete Metabolic Panel (CMP)', description: '14 blood tests for metabolism', category: 'blood', resultsTime: '24 hours', price: 45, icon: 'science' },
    { id: 'thyroid-full', name: 'Comprehensive Thyroid Panel', description: 'TSH, T3, T4, and antibodies', category: 'hormone', resultsTime: '48 hours', price: 89, icon: 'monitor_heart' },
    { id: 'lipid', name: 'Lipid Panel', description: 'Cholesterol and triglycerides', category: 'cardiac', resultsTime: '24 hours', price: 35, icon: 'favorite' },
    { id: 'a1c', name: 'Hemoglobin A1C', description: 'Blood sugar average over 3 months', category: 'blood', resultsTime: '24 hours', price: 32, icon: 'water_drop' },
    { id: 'vitd', name: 'Vitamin D, 25-Hydroxy', description: 'Vitamin D deficiency screening', category: 'blood', resultsTime: '48 hours', price: 55, icon: 'wb_sunny' },
    { id: 'tsh', name: 'Thyroid Stimulating Hormone (TSH)', description: 'Basic thyroid function test', category: 'hormone', resultsTime: '24 hours', price: 35, icon: 'monitor_heart' },
    { id: 'xray', name: 'Chest X-Ray', description: 'Standard chest radiograph', category: 'imaging', resultsTime: '2-4 hours', price: 75, icon: 'image' },
    { id: 'mri', name: 'MRI Brain', description: 'Detailed brain imaging', category: 'imaging', resultsTime: '24-48 hours', price: 450, icon: 'image' },
    { id: 'ct', name: 'CT Scan Abdomen', description: 'Abdominal computed tomography', category: 'imaging', resultsTime: '24 hours', price: 350, icon: 'image' },
    { id: 'ecg', name: 'Electrocardiogram (ECG/EKG)', description: 'Heart electrical activity', category: 'cardiac', resultsTime: '1 hour', price: 50, icon: 'favorite' },
    { id: 'echo', name: 'Echocardiogram', description: 'Heart ultrasound imaging', category: 'cardiac', resultsTime: '24 hours', price: 180, icon: 'favorite' },
    { id: 'testosterone', name: 'Testosterone, Total', description: 'Male hormone level test', category: 'hormone', resultsTime: '48 hours', price: 65, icon: 'science' },
    { id: 'estrogen', name: 'Estrogen Panel', description: 'Female hormone levels', category: 'hormone', resultsTime: '48 hours', price: 85, icon: 'science' },
    { id: 'genetic', name: 'Genetic Carrier Screening', description: 'Hereditary condition testing', category: 'genetic', resultsTime: '2-3 weeks', price: 299, icon: 'biotech' },
    { id: 'brca', name: 'BRCA Gene Testing', description: 'Breast cancer gene analysis', category: 'genetic', resultsTime: '2-3 weeks', price: 399, icon: 'biotech' },
    { id: 'food-allergy', name: 'Food Allergy Panel', description: 'Common food allergen test', category: 'allergy', resultsTime: '5-7 days', price: 189, icon: 'restaurant' },
    { id: 'resp-allergy', name: 'Respiratory Allergy Panel', description: 'Airborne allergen screening', category: 'allergy', resultsTime: '5-7 days', price: 169, icon: 'air' },
    { id: 'psa', name: 'Prostate Specific Antigen (PSA)', description: 'Prostate health screening', category: 'blood', resultsTime: '24 hours', price: 45, icon: 'science' },
    { id: 'liver', name: 'Liver Function Panel', description: 'Hepatic health assessment', category: 'blood', resultsTime: '24 hours', price: 42, icon: 'science' },
    { id: 'glucose', name: 'Blood Glucose Test', description: 'Fasting blood sugar level', category: 'blood', resultsTime: '12 hours', price: 25, icon: 'water_drop' },
    { id: 'metabolic', name: 'Basic Metabolic Panel', description: 'Kidney function and electrolytes', category: 'blood', resultsTime: '24 hours', price: 50, icon: 'biotech' }
  ];

  // Step 2: Date/Time Selection
  currentMonth: Date = new Date();
  selectedDate: Date | null = null;
  selectedTime: string | null = null;
  selectedLocation: Location | null = null;
  isDateTimeCollapsed = false;

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
    },
    {
      id: 'midtown',
      name: 'Midtown Lab Services',
      address: '789 Fifth Avenue, Suite 1200',
      city: 'New York, NY 10022',
      distance: '1.3 miles away'
    },
    {
      id: 'uptown',
      name: 'Uptown Health Labs',
      address: '321 Madison Ave, Floor 5',
      city: 'New York, NY 10017',
      distance: '2.8 miles away'
    },
    {
      id: 'eastside',
      name: 'East Side Medical Testing',
      address: '555 Lexington Ave',
      city: 'New York, NY 10022',
      distance: '1.7 miles away'
    },
    {
      id: 'chelsea',
      name: 'Chelsea Diagnostic Center',
      address: '200 West 23rd Street',
      city: 'New York, NY 10011',
      distance: '3.2 miles away'
    },
    {
      id: 'soho',
      name: 'SoHo Medical Labs',
      address: '150 Spring Street, Suite 300',
      city: 'New York, NY 10012',
      distance: '2.5 miles away'
    },
    {
      id: 'tribeca',
      name: 'TriBeCa Health Center',
      address: '75 Greenwich Street',
      city: 'New York, NY 10006',
      distance: '3.8 miles away'
    },
    {
      id: 'uws',
      name: 'Upper West Side Diagnostics',
      address: '2100 Broadway, Floor 2',
      city: 'New York, NY 10023',
      distance: '4.1 miles away'
    },
    {
      id: 'ues',
      name: 'Upper East Side Lab Center',
      address: '1234 Park Avenue',
      city: 'New York, NY 10128',
      distance: '4.5 miles away'
    }
  ];

  // Step 3: ID Upload
  ocrData: DocumentData | null = null;
  isProcessingOcr = false;
  ocrProgress = 0;
  uploadSkipped = false;
  currentJobId: string | null = null;
  ocrError: string | null = null;
  uploadedImageUrl: string | null = null;
  showImageModal = false;

  // Step 3: Insurance Card Upload
  insuranceData: { carrier: string; memberId: string } | null = null;
  isProcessingInsurance = false;
  insuranceProgress = 0;
  insuranceSkipped = false;
  insuranceError: string | null = null;
  insuranceImageUrl: string | null = null;
  showInsuranceModal = false;

  // Step 4: Patient Details Form
  patientForm!: FormGroup;

  // Step 5: Payment
  paymentForm!: FormGroup;
  selectedPaymentMethod: string = 'card';
  isProcessingPayment = false;
  paymentMethods = [
    { id: 'paypal', name: 'PayPal', icon: 'paypal' },
    { id: 'google-pay', name: 'Google Pay', icon: 'google-pay' },
    { id: 'apple-pay', name: 'Apple Pay', icon: 'apple-pay' },
    { id: 'card', name: 'Card', icon: 'credit-card' },
    { id: 'link', name: 'Link', icon: 'link' },
    { id: 'shop', name: 'Shop Pay', icon: 'shop' },
    { id: 'klarna', name: 'Klarna', icon: 'klarna' },
    { id: 'affirm', name: 'Affirm', icon: 'affirm' },
    { id: 'bank', name: 'Bank Account', icon: 'bank' },
    { id: 'cashapp', name: 'Cash App', icon: 'cashapp' }
  ];

  // Step 6: Confirmation
  bookingConfirmed = false;
  confirmationNumber = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.test-search-container')) {
      this.isTestDropdownOpen = false;
    }
  }

  ngOnInit(): void {
    // Select today's date by default if it's a weekday
    this.selectTodayIfAvailable();
    this.generateCalendar();
    this.initPatientForm();
    this.initPaymentForm();
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

  private selectTodayIfAvailable(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();

    // If today is a weekday (Mon-Fri), select it
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      this.selectedDate = today;
    } else {
      // If weekend, select next Monday
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + daysUntilMonday);
      this.selectedDate = nextMonday;
    }
  }

  initPatientForm(): void {
    this.patientForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      dob: ['', Validators.required],
      sex: ['', Validators.required],
      addressStreet: ['', Validators.required],
      addressCity: ['', Validators.required],
      addressState: ['', Validators.required],
      addressZip: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\(\d{3}\) \d{3}-\d{4}$/)]],
      insuranceProvider: [''],
      memberId: ['']
    });
  }

  initPaymentForm(): void {
    this.paymentForm = this.fb.group({
      cardNumber: ['', [Validators.required, Validators.pattern(/^\d{4}\s\d{4}\s\d{4}\s\d{4}$/)]],
      expiration: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
      cvc: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
      zip: ['', [Validators.required, Validators.pattern(/^\d{5}(-\d{4})?$/)]],
      bankRoutingNumber: [''],
      bankAccountNumber: ['']
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
    // Collapse date-time section and scroll to location after animation
    setTimeout(() => {
      this.isDateTimeCollapsed = true;
      // Scroll to location section after collapse animation completes
      setTimeout(() => {
        this.scrollToLocationSection();
      }, 400);
    }, 100);
  }

  expandDateTime(): void {
    this.isDateTimeCollapsed = false;
  }

  private scrollToLocationSection(): void {
    if (this.locationSectionRef?.nativeElement) {
      this.locationSectionRef.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  selectLocation(location: Location): void {
    this.selectedLocation = location;
  }

  /**
   * Get marker position on the map based on index
   * Returns pseudo-random but consistent positions for each location
   */
  getMarkerPosition(index: number): { x: number; y: number } {
    // Predefined positions to spread markers across the map
    const positions = [
      { x: 25, y: 30 },   // downtown
      { x: 15, y: 55 },   // westside
      { x: 45, y: 25 },   // midtown
      { x: 70, y: 20 },   // uptown
      { x: 75, y: 45 },   // eastside
      { x: 30, y: 70 },   // chelsea
      { x: 55, y: 65 },   // soho
      { x: 40, y: 80 },   // tribeca
      { x: 20, y: 40 },   // uws
      { x: 80, y: 70 },   // ues
    ];
    return positions[index % positions.length];
  }

  selectTest(test: MedicalTest): void {
    this.selectedTest = test;
  }

  // ===========================
  // Step 1: Test Search Methods
  // ===========================

  onTestSearchFocus(): void {
    this.isTestDropdownOpen = true;
    if (this.testSearchQuery) {
      this.filterTests();
    }
  }

  onTestSearchInput(): void {
    this.isTestDropdownOpen = true;
    this.testHighlightedIndex = -1;

    const query = this.testSearchQuery.trim().toLowerCase();

    if (query.length > 0) {
      this.isTestSearchLoading = true;
      // Simulate API delay for better UX
      setTimeout(() => {
        this.filteredTests = this.medicalTests.filter(test =>
          test.name.toLowerCase().includes(query) ||
          test.description.toLowerCase().includes(query) ||
          test.category.toLowerCase().includes(query)
        );
        this.isTestSearchLoading = false;
        this.testHighlightedIndex = -1;
      }, 200);
    } else {
      this.filteredTests = [];
      this.isTestSearchLoading = false;
    }
  }

  private filterTests(): void {
    const query = this.testSearchQuery.trim().toLowerCase();
    if (query.length > 0) {
      this.filteredTests = this.medicalTests.filter(test =>
        test.name.toLowerCase().includes(query) ||
        test.description.toLowerCase().includes(query) ||
        test.category.toLowerCase().includes(query)
      );
    } else {
      this.filteredTests = [];
    }
  }

  onTestSearchKeyDown(event: KeyboardEvent): void {
    if (!this.isTestDropdownOpen) return;

    const items = this.filteredTests.length > 0 ? this.filteredTests : [];

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.testHighlightedIndex = Math.min(
          this.testHighlightedIndex + 1,
          items.length - 1
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.testHighlightedIndex = Math.max(this.testHighlightedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.testHighlightedIndex >= 0 && items[this.testHighlightedIndex]) {
          this.selectFilteredTest(items[this.testHighlightedIndex]);
        }
        break;
      case 'Escape':
        this.isTestDropdownOpen = false;
        break;
    }
  }

  clearTestSearch(): void {
    this.testSearchQuery = '';
    this.filteredTests = [];
    this.isTestDropdownOpen = false;
    this.testHighlightedIndex = -1;
    this.isTestSearchLoading = false;
    this.testSearchInputRef?.nativeElement.focus();
  }

  selectTestCategory(category: TestCategory): void {
    this.testSearchQuery = category.name;
    this.filteredTests = this.medicalTests.filter(t => t.category === category.id);
    this.isTestSearchLoading = false;
  }

  selectRecentSearch(recent: RecentSearch): void {
    this.testSearchQuery = recent.name;
    this.onTestSearchInput();
  }

  clearRecentSearches(): void {
    this.recentSearches = [];
  }

  selectFilteredTest(test: MedicalTest): void {
    this.selectedTest = test;
    this.testSearchQuery = '';
    this.filteredTests = [];
    this.isTestDropdownOpen = false;
    this.testHighlightedIndex = -1;
    this.isTestSearchLoading = false;
  }

  highlightSearchMatch(text: string): string {
    if (!this.testSearchQuery.trim()) return text;
    const regex = new RegExp(`(${this.escapeRegExp(this.testSearchQuery)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getCategoryClass(category: string): string {
    const classMap: { [key: string]: string } = {
      blood: 'blood',
      imaging: 'imaging',
      cardiac: 'cardiac',
      hormone: 'hormone',
      genetic: 'genetic',
      allergy: 'allergy'
    };
    return classMap[category] || 'blood';
  }

  getIconClass(category: string): string {
    return this.getCategoryClass(category);
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
        // Step 5 (Payment) - Validate based on selected payment method
        return this.isPaymentValid();
      case 6:
        return true;
      default:
        return false;
    }
  }

  isPaymentValid(): boolean {
    if (this.isProcessingPayment) return false;

    if (this.selectedPaymentMethod === 'card') {
      return this.paymentForm.get('cardNumber')?.valid === true &&
             this.paymentForm.get('expiration')?.valid === true &&
             this.paymentForm.get('cvc')?.valid === true &&
             this.paymentForm.get('zip')?.valid === true;
    } else if (this.selectedPaymentMethod === 'bank') {
      return this.paymentForm.get('bankRoutingNumber')?.value?.length === 9 &&
             this.paymentForm.get('bankAccountNumber')?.value?.length >= 4;
    } else {
      // For wallet-based payments (PayPal, Google Pay, Apple Pay, etc.)
      // They handle their own validation
      return true;
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

        // Confirm booking when entering Step 6
        if (this.currentStep === 6) {
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
      this.isDateTimeCollapsed = false;
      this.patientForm.reset();
      this.bookingConfirmed = false;
      this.confirmationNumber = '';
      this.generateCalendar();

      // Reset test search state
      this.testSearchQuery = '';
      this.filteredTests = [];
      this.isTestDropdownOpen = false;
      this.testHighlightedIndex = -1;
      this.isTestSearchLoading = false;

      // Reset ID upload state
      this.ocrData = null;
      this.ocrError = null;
      this.isProcessingOcr = false;
      this.ocrProgress = 0;
      this.uploadSkipped = false;
      this.currentJobId = null;
      this.uploadedImageUrl = null;
      this.showImageModal = false;

      // Reset insurance upload state
      this.insuranceData = null;
      this.insuranceError = null;
      this.isProcessingInsurance = false;
      this.insuranceProgress = 0;
      this.insuranceSkipped = false;
      this.insuranceImageUrl = null;
      this.showInsuranceModal = false;

      // Reset payment state
      this.paymentForm.reset();
      this.selectedPaymentMethod = 'card';
      this.isProcessingPayment = false;

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
    // Create a persistent data URL for the uploaded image
    this.createImagePreview(file);
    this.processDocument(file);
  }

  /**
   * Convert file to base64 data URL for persistent preview
   */
  private createImagePreview(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.uploadedImageUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
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
    this.uploadedImageUrl = null;
    this.showImageModal = false;
  }

  // ===========================
  // Insurance Card Upload Methods
  // ===========================

  /**
   * Handle insurance card file upload
   */
  onInsuranceFileProcessed(file: File): void {
    this.createInsuranceImagePreview(file);
    this.processInsuranceCard(file);
  }

  /**
   * Convert insurance file to base64 data URL for persistent preview
   */
  private createInsuranceImagePreview(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.insuranceImageUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Process insurance card through OCR
   */
  private processInsuranceCard(file: File): void {
    this.isProcessingInsurance = true;
    this.insuranceProgress = 0;
    this.insuranceData = null;
    this.insuranceError = null;
    this.insuranceSkipped = false;

    // Simulate progress animation
    const progressInterval = setInterval(() => {
      if (this.insuranceProgress < 80) {
        this.insuranceProgress += 10;
      }
    }, 200);

    // Use the API service to process the insurance card
    this.apiService.processInsuranceCard(file).subscribe({
      next: (response) => {
        clearInterval(progressInterval);
        this.insuranceProgress = 100;
        this.isProcessingInsurance = false;

        if (response.status === 'completed' && response.data) {
          this.insuranceData = {
            carrier: response.data.carrier || '',
            memberId: response.data.memberId || ''
          };
          this.snackBar.open(
            'Insurance card processed successfully!',
            'Close',
            {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'top'
            }
          );
        } else if (response.status === 'error') {
          this.insuranceError = response.error || 'Failed to process insurance card';
        }
      },
      error: (error) => {
        clearInterval(progressInterval);
        this.isProcessingInsurance = false;
        this.insuranceProgress = 0;
        this.insuranceError = error.message || 'Failed to process insurance card';
        this.snackBar.open(
          'Failed to process insurance card: ' + this.insuranceError,
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
   * Skip insurance card upload
   */
  skipInsuranceUpload(): void {
    this.insuranceSkipped = true;
    this.insuranceData = null;
    this.insuranceError = null;
  }

  /**
   * Retry insurance card processing after an error
   */
  retryInsuranceUpload(): void {
    this.insuranceError = null;
    this.insuranceData = null;
  }

  /**
   * Clear current insurance upload and allow new upload
   */
  clearInsuranceUpload(): void {
    this.insuranceData = null;
    this.insuranceError = null;
    this.insuranceProgress = 0;
    this.insuranceSkipped = false;
    this.insuranceImageUrl = null;
    this.showInsuranceModal = false;
  }

  /**
   * Open insurance image modal
   */
  openInsuranceImageModal(): void {
    this.showInsuranceModal = true;
  }

  /**
   * Close insurance image modal
   */
  closeInsuranceImageModal(): void {
    this.showInsuranceModal = false;
  }

  /**
   * Pre-fill patient form with OCR extracted data and insurance data
   */
  private prefillPatientForm(): void {
    const formUpdates: { [key: string]: any } = {};

    // Map OCR data to patient form fields
    if (this.ocrData) {
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
      if (this.ocrData.sex) {
        formUpdates['sex'] = this.ocrData.sex;
      }
      if (this.ocrData.addressStreet) {
        formUpdates['addressStreet'] = this.ocrData.addressStreet;
      }
      if (this.ocrData.addressCity) {
        formUpdates['addressCity'] = this.ocrData.addressCity;
      }
      if (this.ocrData.addressState) {
        formUpdates['addressState'] = this.ocrData.addressState;
      }
      if (this.ocrData.addressZip) {
        formUpdates['addressZip'] = this.ocrData.addressZip;
      }
    }

    // Map insurance data to form fields
    if (this.insuranceData) {
      if (this.insuranceData.carrier) {
        // Map carrier name to form value
        const carrierMap: { [key: string]: string } = {
          'aetna': 'aetna',
          'blue cross': 'bluecross',
          'blue cross blue shield': 'bluecross',
          'bcbs': 'bluecross',
          'cigna': 'cigna',
          'united': 'united',
          'united healthcare': 'united',
          'unitedhealthcare': 'united',
          'humana': 'humana',
          'kaiser': 'kaiser',
          'kaiser permanente': 'kaiser'
        };
        const normalizedCarrier = this.insuranceData.carrier.toLowerCase();
        const matchedCarrier = Object.keys(carrierMap).find(key =>
          normalizedCarrier.includes(key)
        );
        formUpdates['insuranceProvider'] = matchedCarrier ? carrierMap[matchedCarrier] : 'other';
      }
      if (this.insuranceData.memberId) {
        formUpdates['memberId'] = this.insuranceData.memberId;
      }
    }

    // Patch form with extracted values
    if (Object.keys(formUpdates).length > 0) {
      this.patientForm.patchValue(formUpdates);

      // Show success message about pre-fill
      const message = this.ocrData && this.insuranceData
        ? 'Form pre-filled with your ID and insurance information. Please verify and complete.'
        : this.ocrData
          ? 'Form pre-filled with your ID information. Please verify and complete.'
          : 'Form pre-filled with your insurance information. Please verify and complete.';

      this.snackBar.open(message, 'OK', {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    }
  }

  // ===========================
  // Image Modal Methods
  // ===========================

  /**
   * Open the image preview modal
   */
  openImageModal(): void {
    this.showImageModal = true;
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close the image preview modal
   */
  closeImageModal(): void {
    this.showImageModal = false;
    // Restore body scroll
    document.body.style.overflow = '';
  }

  /**
   * Format date of birth for display
   */
  formatDob(dob: Date | null): string {
    if (!dob) return '';
    const date = dob instanceof Date ? dob : new Date(dob);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // ===========================
  // Step 5: Payment Methods
  // ===========================

  /**
   * Select payment method
   */
  selectPaymentMethod(methodId: string): void {
    this.selectedPaymentMethod = methodId;
  }

  /**
   * Format card number with spaces (4-4-4-4)
   */
  formatCardNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');

    if (value.length > 16) {
      value = value.slice(0, 16);
    }

    // Add spaces every 4 digits
    const parts = [];
    for (let i = 0; i < value.length; i += 4) {
      parts.push(value.slice(i, i + 4));
    }
    value = parts.join(' ');

    this.paymentForm.patchValue({ cardNumber: value });
  }

  /**
   * Format expiration date (MM/YY)
   */
  formatExpiration(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');

    if (value.length > 4) {
      value = value.slice(0, 4);
    }

    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }

    this.paymentForm.patchValue({ expiration: value });
  }

  /**
   * Format CVC (3-4 digits only)
   */
  formatCvc(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');

    if (value.length > 4) {
      value = value.slice(0, 4);
    }

    this.paymentForm.patchValue({ cvc: value });
  }

  /**
   * Format ZIP code
   */
  formatZip(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^\d-]/g, '');

    if (value.length > 10) {
      value = value.slice(0, 10);
    }

    this.paymentForm.patchValue({ zip: value });
  }

  /**
   * Format routing number (9 digits)
   */
  formatRoutingNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');

    if (value.length > 9) {
      value = value.slice(0, 9);
    }

    this.paymentForm.patchValue({ bankRoutingNumber: value });
  }

  /**
   * Format account number
   */
  formatAccountNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');

    if (value.length > 17) {
      value = value.slice(0, 17);
    }

    this.paymentForm.patchValue({ bankAccountNumber: value });
  }

  /**
   * Detect card type from number
   */
  getCardType(): string {
    const cardNumber = this.paymentForm.get('cardNumber')?.value?.replace(/\s/g, '') || '';

    if (cardNumber.startsWith('4')) return 'visa';
    if (/^5[1-5]/.test(cardNumber) || /^2[2-7]/.test(cardNumber)) return 'mastercard';
    if (/^3[47]/.test(cardNumber)) return 'amex';
    if (/^6(?:011|5)/.test(cardNumber)) return 'discover';
    return 'unknown';
  }

  /**
   * Process wallet payment (PayPal, Google Pay, Apple Pay, etc.)
   */
  processWalletPayment(methodId: string): void {
    this.selectedPaymentMethod = methodId;
    // In a real implementation, this would trigger the respective payment SDK
    // For now, we'll simulate by just proceeding to the next step
    this.snackBar.open(
      `${this.paymentMethods.find(m => m.id === methodId)?.name} selected. Click Continue to proceed.`,
      'OK',
      {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      }
    );
  }
}
