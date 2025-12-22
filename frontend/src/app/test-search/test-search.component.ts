import { Component, OnInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { trigger, style, animate, transition } from '@angular/animations';

export interface MedicalTest {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  resultsTime: string;
  icon: string;
}

interface RecentSearch {
  name: string;
  searchedAgo: string;
}

@Component({
  selector: 'app-test-search',
  templateUrl: './test-search.component.html',
  styleUrls: ['./test-search.component.scss'],
  animations: [
    trigger('dropdownAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class TestSearchComponent implements OnInit {
  @ViewChild('searchInput') searchInputRef!: ElementRef;

  searchQuery = '';
  isDropdownOpen = false;
  isLoading = false;
  highlightedIndex = -1;

  // Multi-select: Array of selected tests
  selectedTests: MedicalTest[] = [];

  // All medical tests
  medicalTests: MedicalTest[] = [
    { id: 'cbc', name: 'Complete Blood Count (CBC)', description: 'Comprehensive blood cell analysis', category: 'blood', price: 29, resultsTime: '24 hours', icon: 'favorite' },
    { id: 'cmp', name: 'Complete Metabolic Panel (CMP)', description: '14 blood tests for metabolism', category: 'blood', price: 45, resultsTime: '24 hours', icon: 'science' },
    { id: 'thyroid-full', name: 'Comprehensive Thyroid Panel', description: 'TSH, T3, T4, and antibodies', category: 'hormone', price: 89, resultsTime: '48 hours', icon: 'monitor_heart' },
    { id: 'lipid', name: 'Lipid Panel', description: 'Cholesterol and triglycerides', category: 'cardiac', price: 35, resultsTime: '24 hours', icon: 'favorite' },
    { id: 'a1c', name: 'Hemoglobin A1C', description: 'Blood sugar average over 3 months', category: 'blood', price: 32, resultsTime: '24 hours', icon: 'water_drop' },
    { id: 'vitd', name: 'Vitamin D, 25-Hydroxy', description: 'Vitamin D deficiency screening', category: 'blood', price: 55, resultsTime: '48 hours', icon: 'wb_sunny' },
    { id: 'tsh', name: 'Thyroid Stimulating Hormone (TSH)', description: 'Basic thyroid function test', category: 'hormone', price: 35, resultsTime: '24 hours', icon: 'monitor_heart' },
    { id: 'xray', name: 'Chest X-Ray', description: 'Standard chest radiograph', category: 'imaging', price: 75, resultsTime: '2-4 hours', icon: 'image' },
    { id: 'mri', name: 'MRI Brain', description: 'Detailed brain imaging', category: 'imaging', price: 450, resultsTime: '24-48 hours', icon: 'image' },
    { id: 'ct', name: 'CT Scan Abdomen', description: 'Abdominal computed tomography', category: 'imaging', price: 350, resultsTime: '24 hours', icon: 'image' },
    { id: 'ecg', name: 'Electrocardiogram (ECG/EKG)', description: 'Heart electrical activity', category: 'cardiac', price: 50, resultsTime: '1 hour', icon: 'favorite' },
    { id: 'echo', name: 'Echocardiogram', description: 'Heart ultrasound imaging', category: 'cardiac', price: 180, resultsTime: '24 hours', icon: 'favorite' },
    { id: 'testosterone', name: 'Testosterone, Total', description: 'Male hormone level test', category: 'hormone', price: 65, resultsTime: '48 hours', icon: 'science' },
    { id: 'estrogen', name: 'Estrogen Panel', description: 'Female hormone levels', category: 'hormone', price: 85, resultsTime: '48 hours', icon: 'science' },
    { id: 'genetic', name: 'Genetic Carrier Screening', description: 'Hereditary condition testing', category: 'genetic', price: 299, resultsTime: '2-3 weeks', icon: 'biotech' },
    { id: 'brca', name: 'BRCA Gene Testing', description: 'Breast cancer gene analysis', category: 'genetic', price: 399, resultsTime: '2-3 weeks', icon: 'biotech' },
    { id: 'food-allergy', name: 'Food Allergy Panel', description: 'Common food allergen test', category: 'allergy', price: 189, resultsTime: '5-7 days', icon: 'restaurant' },
    { id: 'resp-allergy', name: 'Respiratory Allergy Panel', description: 'Airborne allergen screening', category: 'allergy', price: 169, resultsTime: '5-7 days', icon: 'air' },
    { id: 'psa', name: 'Prostate Specific Antigen (PSA)', description: 'Prostate health screening', category: 'blood', price: 45, resultsTime: '24 hours', icon: 'science' },
    { id: 'liver', name: 'Liver Function Panel', description: 'Hepatic health assessment', category: 'blood', price: 42, resultsTime: '24 hours', icon: 'science' },
    { id: 'glucose', name: 'Blood Glucose Test', description: 'Fasting blood sugar level', category: 'blood', price: 25, resultsTime: '12 hours', icon: 'water_drop' },
    { id: 'metabolic', name: 'Basic Metabolic Panel', description: 'Kidney function and electrolytes', category: 'blood', price: 50, resultsTime: '24 hours', icon: 'biotech' }
  ];

  // Search results
  searchResults: MedicalTest[] = [];

  // Recent searches
  recentSearches: RecentSearch[] = [
    { name: 'Complete Blood Count (CBC)', searchedAgo: '2 days ago' },
    { name: 'Lipid Panel', searchedAgo: '1 week ago' }
  ];

  // Categories
  categories = [
    { id: 'blood', name: 'Blood Tests', icon: 'water_drop' },
    { id: 'imaging', name: 'Imaging', icon: 'image' },
    { id: 'cardiac', name: 'Cardiac', icon: 'favorite' },
    { id: 'hormone', name: 'Hormones', icon: 'monitor_heart' },
    { id: 'genetic', name: 'Genetic', icon: 'biotech' }
  ];

  // Popular tests
  popularTests: MedicalTest[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Set popular tests
    this.popularTests = this.medicalTests.filter(t =>
      ['cbc', 'tsh', 'lipid'].includes(t.id)
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-container')) {
      this.isDropdownOpen = false;
    }
  }

  onSearchFocus(): void {
    this.isDropdownOpen = true;
  }

  onSearchInput(): void {
    const query = this.searchQuery.trim().toLowerCase();

    if (query.length > 0) {
      this.isLoading = true;
      // Simulate API delay
      setTimeout(() => {
        this.searchResults = this.medicalTests.filter(test =>
          test.name.toLowerCase().includes(query) ||
          test.description.toLowerCase().includes(query) ||
          test.category.toLowerCase().includes(query)
        );
        this.isLoading = false;
        this.highlightedIndex = -1;
      }, 200);
    } else {
      this.searchResults = [];
      this.isLoading = false;
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.isDropdownOpen) return;

    const items = this.searchResults.length > 0 ? this.searchResults : [];

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex = Math.min(this.highlightedIndex + 1, items.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.highlightedIndex >= 0 && items[this.highlightedIndex]) {
          this.selectTest(items[this.highlightedIndex]);
        }
        break;
      case 'Escape':
        this.isDropdownOpen = false;
        break;
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults = [];
    this.searchInputRef?.nativeElement.focus();
  }

  selectCategory(category: { id: string; name: string }): void {
    this.searchQuery = category.name;
    this.searchResults = this.medicalTests.filter(t => t.category === category.id);
    this.isLoading = false;
  }

  selectRecentSearch(recent: RecentSearch): void {
    this.searchQuery = recent.name;
    this.onSearchInput();
  }

  clearRecentSearches(): void {
    this.recentSearches = [];
  }

  selectTest(test: MedicalTest): void {
    // Toggle selection - add if not selected, remove if already selected
    const existingIndex = this.selectedTests.findIndex(t => t.id === test.id);
    if (existingIndex >= 0) {
      this.selectedTests.splice(existingIndex, 1);
    } else {
      this.selectedTests.push(test);
    }
    // Keep dropdown open for multi-select, clear search query
    this.searchQuery = '';
    this.searchResults = [];
    this.searchInputRef?.nativeElement.focus();
  }

  removeSelectedTest(test: MedicalTest, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const index = this.selectedTests.findIndex(t => t.id === test.id);
    if (index >= 0) {
      this.selectedTests.splice(index, 1);
    }
  }

  isTestSelected(test: MedicalTest): boolean {
    return this.selectedTests.some(t => t.id === test.id);
  }

  getSelectedTotal(): number {
    return this.selectedTests.reduce((sum, test) => sum + test.price, 0);
  }

  proceedToBooking(): void {
    if (this.selectedTests.length === 0) return;
    this.isDropdownOpen = false;
    // Navigate to booking page with all selected test IDs
    const testIds = this.selectedTests.map(t => t.id).join(',');
    this.router.navigate(['/book-test'], {
      queryParams: { testIds: testIds }
    });
  }

  onPopularTestClick(test: MedicalTest): void {
    this.selectTest(test);
  }

  highlightMatch(text: string): string {
    if (!this.searchQuery.trim()) return text;
    const regex = new RegExp(`(${this.escapeRegExp(this.searchQuery)})`, 'gi');
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

  getBadgeText(test: MedicalTest): string {
    if (test.id === 'cbc') return 'Most Popular';
    if (test.id === 'tsh') return 'Recommended';
    if (test.id === 'lipid') return 'Heart Health';
    return '';
  }
}
