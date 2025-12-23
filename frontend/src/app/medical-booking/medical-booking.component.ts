import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
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
import { AuthService } from '../services/auth.service';
import { VapiService, ExtractedDataWithConfidence } from '../services/vapi.service';
import { AudioService, AudioProcessingState } from '../services/audio.service';
import { BookingFormData } from '../components/vapi-assistant/vapi-assistant.component';

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
  standalone: false,
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

    // Dropdown content transition animation
    trigger('dropdownContentAnimation', [
      transition('categories => tests', [
        style({ opacity: 1 }),
        animate('150ms ease-out', style({ opacity: 0, transform: 'translateX(-20px)' })),
      ]),
      transition('tests => categories', [
        style({ opacity: 1 }),
        animate('150ms ease-out', style({ opacity: 0, transform: 'translateX(20px)' })),
      ]),
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(20px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
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
    ]),

    // Slide in up animation for assistant
    trigger('slideInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(50px)' }),
        animate('500ms 100ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('400ms ease-in', style({ opacity: 0, transform: 'translateY(50px)' }))
      ])
    ])
  ]
})
export class MedicalBookingComponent implements OnInit, OnDestroy {
  @ViewChild('testSearchInput') testSearchInputRef!: ElementRef;
  @ViewChild('locationSection') locationSectionRef!: ElementRef;
  @ViewChild('phoneInput') phoneInputRef!: ElementRef;

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
  dropdownView: 'categories' | 'tests' = 'categories';
  selectedCategory: TestCategory | null = null;
  isDropdownAnimating = false;

  // Categories for quick browse
  testCategories: TestCategory[] = [
    { id: 'blood', name: 'Blood Tests', icon: 'water_drop' },
    { id: 'imaging', name: 'Imaging', icon: 'image' },
    { id: 'cardiac', name: 'Cardiac', icon: 'favorite' },
    { id: 'hormone', name: 'Hormones', icon: 'monitor_heart' },
    { id: 'genetic', name: 'Genetic', icon: 'biotech' },
    { id: 'nervous', name: 'Nervous System', icon: 'psychology' },
    { id: 'respiratory', name: 'Respiratory', icon: 'air' },
    { id: 'digestive', name: 'Digestive', icon: 'restaurant' },
    { id: 'excretory', name: 'Excretory', icon: 'water' },
    { id: 'womens', name: "Women's Health", icon: 'female' },
    { id: 'mens', name: "Men's Health", icon: 'male' },
    { id: 'immune', name: 'Immune System', icon: 'shield' },
    { id: 'muscular', name: 'Muscular', icon: 'fitness_center' },
    { id: 'skeletal', name: 'Skeletal', icon: 'accessibility' },
    { id: 'integumentary', name: 'Integumentary', icon: 'spa' }
  ];

  // Recent searches
  recentSearches: RecentSearch[] = [
    { name: 'Complete Blood Count (CBC)', searchedAgo: '2 days ago' },
    { name: 'Lipid Panel', searchedAgo: '1 week ago' }
  ];

  // Multi-select: Array of selected tests
  selectedTests: MedicalTest[] = [];
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
    { id: 'metabolic', name: 'Basic Metabolic Panel', description: 'Kidney function and electrolytes', category: 'blood', resultsTime: '24 hours', price: 50, icon: 'biotech' },
    { id: 'tb-test', name: 'TB Test (Tuberculosis)', description: 'Skin or blood test for TB infection', category: 'blood', resultsTime: '48-72 hours', price: 35, icon: 'vaccines' },
    { id: 'drug-test', name: 'Drug Screening Panel', description: '10-panel urine drug test', category: 'blood', resultsTime: '24-48 hours', price: 65, icon: 'medication' },
    { id: 'calcium-score', name: 'Coronary Calcium Score', description: 'CT scan for heart disease risk', category: 'cardiac', resultsTime: '24 hours', price: 149, icon: 'favorite' },
    { id: 'pregnancy', name: 'Pregnancy Test (hCG)', description: 'Blood test to confirm pregnancy', category: 'blood', resultsTime: '24 hours', price: 39, icon: 'pregnant_woman' },
    { id: 'std-panel', name: 'STD/STI Panel', description: 'Comprehensive sexual health screening', category: 'blood', resultsTime: '2-5 days', price: 189, icon: 'health_and_safety' },
    { id: 'hormone-panel', name: 'Complete Hormone Panel', description: 'Full hormone level assessment', category: 'hormone', resultsTime: '3-5 days', price: 249, icon: 'monitor_heart' },

    // Nervous System Tests
    { id: 'b12-neuro', name: 'Vitamin B12 Level', description: 'Neurological health marker', category: 'nervous', resultsTime: '24 hours', price: 45, icon: 'psychology' },
    { id: 'nse', name: 'Neuron-Specific Enolase (NSE)', description: 'Neural tissue marker', category: 'nervous', resultsTime: '48 hours', price: 125, icon: 'psychology' },
    { id: 'anti-neuro', name: 'Anti-Neuronal Antibodies', description: 'Autoimmune neurological screening', category: 'nervous', resultsTime: '5-7 days', price: 275, icon: 'psychology' },
    { id: 'brain-mri', name: 'Brain MRI with Contrast', description: 'Detailed brain imaging study', category: 'nervous', resultsTime: '24-48 hours', price: 550, icon: 'image' },
    { id: 'ct-head', name: 'CT Scan Head', description: 'Rapid brain imaging', category: 'nervous', resultsTime: '2-4 hours', price: 325, icon: 'image' },
    { id: 'emg-ncs', name: 'EMG/Nerve Conduction Study', description: 'Nerve and muscle function test', category: 'nervous', resultsTime: '24 hours', price: 450, icon: 'image' },

    // Respiratory Tests
    { id: 'abg', name: 'Arterial Blood Gas (ABG)', description: 'Oxygen and CO2 levels', category: 'respiratory', resultsTime: '1 hour', price: 85, icon: 'air' },
    { id: 'a1at', name: 'Alpha-1 Antitrypsin', description: 'Lung disease risk marker', category: 'respiratory', resultsTime: '48 hours', price: 145, icon: 'air' },
    { id: 'resp-panel', name: 'Respiratory Pathogen Panel', description: 'Viral and bacterial detection', category: 'respiratory', resultsTime: '24 hours', price: 195, icon: 'air' },
    { id: 'chest-ct', name: 'Chest CT Scan', description: 'Detailed lung imaging', category: 'respiratory', resultsTime: '24 hours', price: 425, icon: 'image' },
    { id: 'pft', name: 'Pulmonary Function Test', description: 'Lung capacity measurement', category: 'respiratory', resultsTime: '1 hour', price: 175, icon: 'image' },
    { id: 'bronch', name: 'Virtual Bronchoscopy', description: '3D airway visualization', category: 'respiratory', resultsTime: '24 hours', price: 550, icon: 'image' },

    // Digestive Tests
    { id: 'liver-enzymes', name: 'Comprehensive Liver Enzymes', description: 'ALT, AST, ALP, GGT panel', category: 'digestive', resultsTime: '24 hours', price: 65, icon: 'restaurant' },
    { id: 'celiac', name: 'Celiac Disease Panel', description: 'Gluten sensitivity screening', category: 'digestive', resultsTime: '48 hours', price: 145, icon: 'restaurant' },
    { id: 'h-pylori', name: 'H. Pylori Antibodies', description: 'Stomach infection test', category: 'digestive', resultsTime: '24 hours', price: 75, icon: 'restaurant' },
    { id: 'abd-us', name: 'Abdominal Ultrasound', description: 'Liver, gallbladder, pancreas imaging', category: 'digestive', resultsTime: '24 hours', price: 225, icon: 'image' },
    { id: 'upper-gi', name: 'Upper GI Series', description: 'Esophagus and stomach X-ray', category: 'digestive', resultsTime: '24 hours', price: 285, icon: 'image' },
    { id: 'mrcp', name: 'MRCP (Bile Duct MRI)', description: 'Biliary system imaging', category: 'digestive', resultsTime: '24-48 hours', price: 475, icon: 'image' },

    // Excretory Tests
    { id: 'bun-creat', name: 'BUN/Creatinine Ratio', description: 'Kidney function assessment', category: 'excretory', resultsTime: '24 hours', price: 35, icon: 'water' },
    { id: 'ua-micro', name: 'Urinalysis with Microscopy', description: 'Comprehensive urine analysis', category: 'excretory', resultsTime: '24 hours', price: 45, icon: 'water' },
    { id: 'kidney-panel', name: 'Renal Function Panel', description: 'Complete kidney assessment', category: 'excretory', resultsTime: '24 hours', price: 85, icon: 'water' },
    { id: 'kidney-us', name: 'Kidney Ultrasound', description: 'Renal imaging study', category: 'excretory', resultsTime: '24 hours', price: 195, icon: 'image' },
    { id: 'ct-urogram', name: 'CT Urogram', description: 'Urinary tract imaging', category: 'excretory', resultsTime: '24 hours', price: 425, icon: 'image' },
    { id: 'vcug', name: 'Voiding Cystourethrogram', description: 'Bladder function imaging', category: 'excretory', resultsTime: '24 hours', price: 325, icon: 'image' },

    // Women's Health Tests
    { id: 'estro-prog', name: 'Estrogen/Progesterone Panel', description: 'Female hormone levels', category: 'womens', resultsTime: '48 hours', price: 95, icon: 'female' },
    { id: 'prenatal', name: 'Prenatal Panel', description: 'Comprehensive pregnancy screening', category: 'womens', resultsTime: '24-48 hours', price: 175, icon: 'female' },
    { id: 'pap', name: 'PAP Smear', description: 'Cervical cancer screening', category: 'womens', resultsTime: '5-7 days', price: 85, icon: 'female' },
    { id: 'mammo', name: 'Digital Mammogram', description: 'Breast cancer screening', category: 'womens', resultsTime: '24-48 hours', price: 225, icon: 'image' },
    { id: 'pelvic-us', name: 'Pelvic Ultrasound', description: 'Uterus and ovary imaging', category: 'womens', resultsTime: '24 hours', price: 275, icon: 'image' },
    { id: 'dexa-w', name: 'DEXA Bone Density Scan', description: 'Osteoporosis screening', category: 'womens', resultsTime: '24 hours', price: 195, icon: 'image' },

    // Men's Health Tests
    { id: 'test-panel', name: 'Testosterone Panel', description: 'Free and total testosterone', category: 'mens', resultsTime: '48 hours', price: 125, icon: 'male' },
    { id: 'psa-screen', name: 'PSA Screening', description: 'Prostate cancer marker', category: 'mens', resultsTime: '24 hours', price: 55, icon: 'male' },
    { id: 'phi', name: 'Prostate Health Index (PHI)', description: 'Advanced prostate screening', category: 'mens', resultsTime: '48 hours', price: 195, icon: 'male' },
    { id: 'prostate-mri', name: 'Prostate MRI', description: 'Detailed prostate imaging', category: 'mens', resultsTime: '24-48 hours', price: 525, icon: 'image' },
    { id: 'testicular-us', name: 'Testicular Ultrasound', description: 'Testicular health imaging', category: 'mens', resultsTime: '24 hours', price: 225, icon: 'image' },
    { id: 'pelvic-ct-m', name: 'Pelvic CT Scan', description: 'Male pelvic imaging', category: 'mens', resultsTime: '24 hours', price: 375, icon: 'image' },

    // Immune System Tests
    { id: 'immune-panel', name: 'Complete Immune Panel', description: 'Comprehensive immunity assessment', category: 'immune', resultsTime: '48 hours', price: 225, icon: 'shield' },
    { id: 'ana', name: 'ANA Screen', description: 'Autoimmune disease screening', category: 'immune', resultsTime: '48 hours', price: 95, icon: 'shield' },
    { id: 'igg-panel', name: 'Immunoglobulin Panel', description: 'IgA, IgG, IgM levels', category: 'immune', resultsTime: '48 hours', price: 145, icon: 'shield' },
    { id: 'lymph-us', name: 'Lymph Node Ultrasound', description: 'Lymphatic system imaging', category: 'immune', resultsTime: '24 hours', price: 195, icon: 'image' },
    { id: 'pet-scan', name: 'PET Scan', description: 'Metabolic activity imaging', category: 'immune', resultsTime: '24-48 hours', price: 1250, icon: 'image' },
    { id: 'spleen-us', name: 'Spleen Ultrasound', description: 'Splenic imaging study', category: 'immune', resultsTime: '24 hours', price: 175, icon: 'image' },

    // Muscular Tests
    { id: 'ck-cpk', name: 'CK/CPK Test', description: 'Muscle damage marker', category: 'muscular', resultsTime: '24 hours', price: 45, icon: 'fitness_center' },
    { id: 'myoglobin', name: 'Myoglobin Level', description: 'Muscle injury marker', category: 'muscular', resultsTime: '24 hours', price: 65, icon: 'fitness_center' },
    { id: 'ldh', name: 'Lactate Dehydrogenase (LDH)', description: 'Tissue damage indicator', category: 'muscular', resultsTime: '24 hours', price: 55, icon: 'fitness_center' },
    { id: 'muscle-mri', name: 'Muscle MRI', description: 'Soft tissue imaging', category: 'muscular', resultsTime: '24-48 hours', price: 475, icon: 'image' },
    { id: 'emg', name: 'Electromyography (EMG)', description: 'Muscle electrical activity', category: 'muscular', resultsTime: '24 hours', price: 325, icon: 'image' },
    { id: 'msk-us', name: 'Musculoskeletal Ultrasound', description: 'Muscle and tendon imaging', category: 'muscular', resultsTime: '24 hours', price: 225, icon: 'image' },

    // Skeletal Tests
    { id: 'calcium', name: 'Calcium/Phosphorus Panel', description: 'Bone mineral levels', category: 'skeletal', resultsTime: '24 hours', price: 45, icon: 'accessibility' },
    { id: 'vitd-bone', name: 'Vitamin D Panel', description: 'Bone health vitamin', category: 'skeletal', resultsTime: '48 hours', price: 65, icon: 'accessibility' },
    { id: 'bone-markers', name: 'Bone Turnover Markers', description: 'Bone metabolism assessment', category: 'skeletal', resultsTime: '48 hours', price: 145, icon: 'accessibility' },
    { id: 'dexa', name: 'Bone Density DEXA Scan', description: 'Osteoporosis screening', category: 'skeletal', resultsTime: '24 hours', price: 195, icon: 'image' },
    { id: 'skeletal-xray', name: 'Skeletal X-Ray Survey', description: 'Full bone X-ray series', category: 'skeletal', resultsTime: '24 hours', price: 275, icon: 'image' },
    { id: 'bone-scan', name: 'Nuclear Bone Scan', description: 'Bone metabolism imaging', category: 'skeletal', resultsTime: '24-48 hours', price: 525, icon: 'image' },

    // Integumentary Tests
    { id: 'ige-panel', name: 'Allergy IgE Panel', description: 'Comprehensive allergy test', category: 'integumentary', resultsTime: '5-7 days', price: 225, icon: 'spa' },
    { id: 'autoimmune-skin', name: 'Autoimmune Skin Panel', description: 'Skin autoantibody screen', category: 'integumentary', resultsTime: '5-7 days', price: 275, icon: 'spa' },
    { id: 'vit-panel', name: 'Vitamin Deficiency Panel', description: 'Skin health vitamins', category: 'integumentary', resultsTime: '48 hours', price: 125, icon: 'spa' },
    { id: 'derm-photo', name: 'Dermoscopy Imaging', description: 'Skin lesion analysis', category: 'integumentary', resultsTime: '24 hours', price: 145, icon: 'image' },
    { id: 'skin-biopsy', name: 'Skin Biopsy Analysis', description: 'Tissue pathology imaging', category: 'integumentary', resultsTime: '5-7 days', price: 325, icon: 'image' },
    { id: 'wound-assess', name: 'Wound Assessment Imaging', description: 'Wound healing evaluation', category: 'integumentary', resultsTime: '24 hours', price: 175, icon: 'image' }
  ];

  // Most Popular Exams (top 20)
  get popularTests(): MedicalTest[] {
    const popularIds = [
      'cbc', 'cmp', 'lipid', 'a1c', 'tsh', 'vitd', 'glucose', 'liver',
      'xray', 'thyroid-full', 'metabolic', 'ecg', 'ua-micro', 'mammo',
      'psa-screen', 'abg', 'ana', 'dexa', 'pelvic-us', 'kidney-panel'
    ];
    return popularIds
      .map(id => this.medicalTests.find(t => t.id === id))
      .filter((t): t is MedicalTest => t !== undefined);
  }

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

  // Voice Assistant
  showVoiceAssistant = false;
  voiceAssistantData: BookingFormData | null = null;
  voiceReasonForTest: string | null = null;
  voicePreferredLocationText: string | null = null;
  voiceDateText: string | null = null;
  voiceTimeText: string | null = null;
  private voiceNavApplied = false;

  // Field confidence tracking for voice-extracted data
  fieldConfidence: { [key: string]: number } = {};
  // Fields that need user review (confidence < 0.7)
  fieldsNeedingReview: string[] = [];
  // Track user-edited fields (these override voice data)
  userEditedFields: Set<string> = new Set();

  // Subscriptions for cleanup
  private refinementSubscription?: Subscription;
  private audioSubscription?: Subscription;
  private callEndSubscription?: Subscription;
  private isProcessingRefinement = false;
  private isValidatingForm = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private vapiService: VapiService,
    private audioService: AudioService
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

    // Subscribe to post-call refinement results from VapiService
    this.setupRefinementSubscription();

    // Subscribe to call-end event to trigger Layer 2 AI post-processing
    this.setupCallEndSubscription();

    // Subscribe to audio upload processing results
    this.setupAudioSubscription();

    // Handle pre-selected tests from search page
    this.route.queryParams.subscribe(params => {
      // Support both single testId and multiple testIds
      if (params['testIds']) {
        const testIds = params['testIds'].split(',');
        this.selectedTests = this.medicalTests.filter(t => testIds.includes(t.id));
        if (this.selectedTests.length > 0) {
          // Skip to step 2 if tests were pre-selected
          this.currentStep = 2;
          this.animationDirection = 'initial';
        }
      } else if (params['testId']) {
        const test = this.medicalTests.find(t => t.id === params['testId']);
        if (test) {
          this.selectedTests = [test];
          // Skip to step 2 if test was pre-selected
          this.currentStep = 2;
          this.animationDirection = 'initial';
        }
      }

      // Also check for voice data passed via navigation state (e.g., from root page assistant)
      this.applyVoiceDataFromNavigation();
    });
  }

  ngOnDestroy(): void {
    this.refinementSubscription?.unsubscribe();
    this.audioSubscription?.unsubscribe();
    this.callEndSubscription?.unsubscribe();
  }

  /**
   * Subscribe to refined data from post-call processing
   * This applies Claude API-refined extraction results to the form
   */
  private setupRefinementSubscription(): void {
    this.refinementSubscription = this.vapiService.refinedData$.subscribe(
      (refinedData: ExtractedDataWithConfidence) => {
        console.log('>>> [MedicalBooking] Received refined data:', refinedData);
        this.applyRefinedDataToForm(refinedData);
      }
    );
  }

  /**
   * Subscribe to call-end event from VapiService.
   * When a voice call ends, this triggers Layer 2 AI post-processing
   * to refine the real-time extracted data using the full transcript.
   */
  private setupCallEndSubscription(): void {
    this.callEndSubscription = this.vapiService.callEnd$.subscribe(
      ({ transcript, collectedData, confidence }) => {
        console.log('>>> [MedicalBooking] Call ended - triggering AI post-processing');
        console.log('>>> [MedicalBooking] Transcript length:', transcript.length);
        console.log('>>> [MedicalBooking] Collected fields:', Object.keys(collectedData).length);

        // Only trigger AI extraction if we have meaningful transcript
        if (transcript.length > 50) {
          this.triggerAIPostProcessing(transcript, collectedData, confidence);
        } else {
          console.log('>>> [MedicalBooking] Transcript too short, skipping AI processing');
        }
      }
    );
  }

  /**
   * Trigger Layer 2 AI post-processing via the backend API.
   * This sends the full transcript to Claude for thorough extraction,
   * then merges the results with Layer 1 real-time data.
   */
  private triggerAIPostProcessing(
    transcript: string,
    layer1Data: BookingFormData,
    layer1Confidence: { [key: string]: number }
  ): void {
    if (this.isProcessingRefinement) {
      console.log('>>> [MedicalBooking] AI processing already in progress, skipping');
      return;
    }

    this.isProcessingRefinement = true;

    this.snackBar.open(
      'Refining form data with AI...',
      '',
      { duration: 3000, horizontalPosition: 'center', verticalPosition: 'top' }
    );

    // Call the backend API for AI extraction
    this.apiService.extractFromTranscript(transcript, layer1Data as any).subscribe({
      next: (result) => {
        if (result.success && result.extractedData) {
          console.log('>>> [MedicalBooking] AI extraction successful:', result);

          // Smart merge Layer 2 results with Layer 1 data
          const mergedData = this.smartMergeVoiceData(
            { ...layer1Data, ...result.extractedData } as BookingFormData,
            result.confidence || {}
          );

          // Update voiceAssistantData and pre-fill form
          this.voiceAssistantData = mergedData;
          this.prefillFromVoiceData(mergedData);
          this.updateFieldsNeedingReview();
          this.cdr.detectChanges();

          // Show success message
          const lowConfidenceCount = this.fieldsNeedingReview.length;
          if (lowConfidenceCount > 0) {
            this.snackBar.open(
              `AI refined ${Object.keys(result.extractedData).length} fields. ${lowConfidenceCount} may need review.`,
              'OK',
              { duration: 5000, horizontalPosition: 'center', verticalPosition: 'top' }
            );
          } else {
            this.snackBar.open(
              'Form data refined with AI analysis.',
              'OK',
              { duration: 3000, horizontalPosition: 'center', verticalPosition: 'top' }
            );
          }
        } else {
          console.error('>>> [MedicalBooking] AI extraction failed:', result.error);
          this.snackBar.open(
            'AI refinement failed. Please review the form manually.',
            'OK',
            { duration: 4000, horizontalPosition: 'center', verticalPosition: 'top' }
          );
        }
        this.isProcessingRefinement = false;
      },
      error: (err) => {
        console.error('>>> [MedicalBooking] AI post-processing error:', err);
        this.snackBar.open(
          'AI refinement error. Please review the form manually.',
          'OK',
          { duration: 4000, horizontalPosition: 'center', verticalPosition: 'top' }
        );
        this.isProcessingRefinement = false;
      }
    });
  }

  /**
   * Subscribe to audio upload processing state
   */
  private setupAudioSubscription(): void {
    this.audioSubscription = this.audioService.extractedData$.subscribe(
      (extractedData) => {
        console.log('>>> [MedicalBooking] Received audio extraction data:', extractedData);
        // Convert to BookingFormData format and apply
        const bookingData: BookingFormData = {
          firstName: extractedData.firstName,
          lastName: extractedData.lastName,
          dob: extractedData.dob,
          sex: extractedData.sex,
          addressStreet: extractedData.addressStreet,
          addressCity: extractedData.addressCity,
          addressState: extractedData.addressState,
          addressZip: extractedData.addressZip,
          email: extractedData.email,
          phone: extractedData.phone,
          insuranceProvider: extractedData.insuranceProvider,
          insuranceId: extractedData.memberId,
          confidence: this.audioService.getState().confidence
        };
        this.onVoiceBookingDataCollected(bookingData);
      }
    );
  }

  /**
   * Apply refined data from post-call processing to the form
   * Uses smart merge to respect user-edited fields and confidence scores
   */
  private applyRefinedDataToForm(refinedData: ExtractedDataWithConfidence): void {
    if (this.isProcessingRefinement) return;
    this.isProcessingRefinement = true;

    try {
      const { data, confidence, overallConfidence } = refinedData;

      // Convert VoiceBookingData to BookingFormData
      const bookingData: BookingFormData = {
        firstName: data.firstName,
        lastName: data.lastName,
        dob: data.dob,
        sex: data.sex,
        address: data.address,
        email: data.email,
        phone: data.phone,
        insuranceProvider: data.insuranceProvider,
        insuranceId: data.insuranceId,
        test: data.test,
        reasons: data.reasons,
        preferredLocation: data.preferredLocation,
        preferredDate: data.preferredDate,
        preferredTime: data.preferredTime,
        confidence: confidence
      };

      // Apply via smart merge (respects user edits and confidence)
      const mergedData = this.smartMergeVoiceData(bookingData, confidence);

      // Update form fields
      this.prefillFromVoiceData(mergedData);

      // Update fields needing review
      this.updateFieldsNeedingReview();

      // Show notification if confidence improved
      const lowConfidenceCount = this.fieldsNeedingReview.length;
      if (lowConfidenceCount > 0) {
        this.snackBar.open(
          `Form refined with AI. ${lowConfidenceCount} field(s) may still need review.`,
          'OK',
          { duration: 5000, horizontalPosition: 'center', verticalPosition: 'top' }
        );
      } else {
        this.snackBar.open(
          'Form refined with AI analysis.',
          'OK',
          { duration: 3000, horizontalPosition: 'center', verticalPosition: 'top' }
        );
      }

      console.log('>>> [MedicalBooking] Applied refined data. Overall confidence:', overallConfidence);
    } finally {
      this.isProcessingRefinement = false;
    }
  }

  /**
   * Trigger post-call refinement manually
   * Called when the voice call ends or when user requests refinement
   */
  async triggerPostCallRefinement(): Promise<void> {
    if (this.isProcessingRefinement) {
      console.log('>>> [MedicalBooking] Refinement already in progress');
      return;
    }

    // Check if we should trigger refinement (low confidence)
    if (!this.vapiService.shouldTriggerRefinement(0.7)) {
      console.log('>>> [MedicalBooking] Confidence is high, skipping refinement');
      return;
    }

    this.snackBar.open(
      'Refining form data with AI...',
      '',
      { duration: 2000, horizontalPosition: 'center', verticalPosition: 'top' }
    );

    try {
      const result = await this.vapiService.processPostCallRefinement();
      if (!result.success) {
        console.error('>>> [MedicalBooking] Refinement failed:', result.error);
        this.snackBar.open(
          'Refinement failed. Please review the form manually.',
          'OK',
          { duration: 4000 }
        );
      }
      // Success is handled by the subscription
    } catch (error) {
      console.error('>>> [MedicalBooking] Refinement error:', error);
    }
  }

  /**
   * If the user came from the root page assistant, pull the voice data from navigation state
   * and pre-fill the booking flow.
   */
  private applyVoiceDataFromNavigation(): void {
    if (this.voiceNavApplied) return;

    const navState = (this.router.getCurrentNavigation()?.extras.state || {}) as { voiceAssistantData?: BookingFormData };
    const historyState = (history.state || {}) as { voiceAssistantData?: BookingFormData };
    const voiceData = navState.voiceAssistantData || historyState.voiceAssistantData;

    if (voiceData) {
      this.voiceNavApplied = true;
      this.onVoiceBookingDataCollected(voiceData);
    }
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
      phone: ['', [Validators.pattern(/^\(\d{3}\) \d{3}-\d{4}$/)]],
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
    // Toggle selection - add if not selected, remove if already selected
    const existingIndex = this.selectedTests.findIndex(t => t.id === test.id);
    if (existingIndex >= 0) {
      this.selectedTests.splice(existingIndex, 1);
    } else {
      this.selectedTests.push(test);
    }
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

  // ===========================
  // Step 1: Test Search Methods
  // ===========================

  onTestSearchFocus(): void {
    this.isTestDropdownOpen = true;
    if (this.testSearchQuery) {
      this.filterTests();
      this.dropdownView = 'tests';
    } else {
      this.dropdownView = 'categories';
      this.selectedCategory = null;
    }
  }

  onTestSearchInput(): void {
    this.isTestDropdownOpen = true;
    this.testHighlightedIndex = -1;

    const query = this.testSearchQuery.trim().toLowerCase();

    if (query.length > 0) {
      this.isTestSearchLoading = true;
      this.dropdownView = 'tests';
      this.selectedCategory = null;

      // Simulate API delay for better UX
      setTimeout(() => {
        this.filteredTests = this.medicalTests.filter(test =>
          test.name.toLowerCase().includes(query) ||
          test.description.toLowerCase().includes(query) ||
          test.category.toLowerCase().includes(query)
        );
        this.isTestSearchLoading = false;
        this.testHighlightedIndex = -1;
        this.cdr.detectChanges(); // Force change detection after async update
      }, 200);
    } else {
      this.filteredTests = [];
      this.isTestSearchLoading = false;
      this.dropdownView = 'categories';
      this.selectedCategory = null;
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
    this.isTestDropdownOpen = true; // Keep dropdown open after clearing
    this.testHighlightedIndex = -1;
    this.isTestSearchLoading = false;
    this.dropdownView = 'categories';
    this.selectedCategory = null;
    this.testSearchInputRef?.nativeElement.focus();
  }

  selectTestCategory(category: TestCategory): void {
    if (this.isDropdownAnimating) return;

    this.isDropdownAnimating = true;
    this.selectedCategory = category;

    // Start fade out animation, then switch content
    setTimeout(() => {
      this.filteredTests = this.medicalTests.filter(t => t.category === category.id);
      this.dropdownView = 'tests';
      this.isTestSearchLoading = false;
      this.testHighlightedIndex = -1;
      this.cdr.detectChanges(); // Force change detection after async update

      // Animation complete
      setTimeout(() => {
        this.isDropdownAnimating = false;
        this.cdr.detectChanges(); // Force change detection after async update
      }, 200);
    }, 150);
  }

  goBackToCategories(): void {
    if (this.isDropdownAnimating) return;

    this.isDropdownAnimating = true;

    setTimeout(() => {
      this.dropdownView = 'categories';
      this.selectedCategory = null;
      this.filteredTests = [];
      this.testSearchQuery = '';
      this.cdr.detectChanges(); // Force change detection after async update

      setTimeout(() => {
        this.isDropdownAnimating = false;
        this.cdr.detectChanges(); // Force change detection after async update
      }, 200);
    }, 150);
  }

  selectRecentSearch(recent: RecentSearch): void {
    this.testSearchQuery = recent.name;
    this.onTestSearchInput();
  }

  clearRecentSearches(): void {
    this.recentSearches = [];
  }

  selectFilteredTest(test: MedicalTest): void {
    // Toggle selection - add if not selected, remove if already selected
    const existingIndex = this.selectedTests.findIndex(t => t.id === test.id);
    if (existingIndex >= 0) {
      this.selectedTests.splice(existingIndex, 1);
    } else {
      this.selectedTests.push(test);
      // Add to recent searches when selecting a test
      this.addToRecentSearches(test);
    }

    // Clear search query but keep dropdown open for multi-select
    this.testSearchQuery = '';
    this.filteredTests = [];
    this.testHighlightedIndex = -1;
    this.isTestSearchLoading = false;
    this.testSearchInputRef?.nativeElement.focus();
  }

  addToRecentSearches(test: MedicalTest): void {
    // Remove if already exists in recent searches
    const existingIndex = this.recentSearches.findIndex(r => r.name === test.name);
    if (existingIndex >= 0) {
      this.recentSearches.splice(existingIndex, 1);
    }

    // Add to beginning of list
    this.recentSearches.unshift({
      name: test.name,
      searchedAgo: 'Just now'
    });

    // Keep only max 3 recent searches
    if (this.recentSearches.length > 3) {
      this.recentSearches = this.recentSearches.slice(0, 3);
    }
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
      allergy: 'allergy',
      nervous: 'nervous',
      respiratory: 'respiratory',
      digestive: 'digestive',
      excretory: 'excretory',
      womens: 'womens',
      mens: 'mens',
      immune: 'immune',
      muscular: 'muscular',
      skeletal: 'skeletal',
      integumentary: 'integumentary'
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
        return this.selectedTests.length > 0;
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
    if (this.canProceed() && this.currentStep < this.totalSteps && !this.isAnimating && !this.isValidatingForm) {
      // Validate form with server when leaving step 4 (Patient Details)
      if (this.currentStep === 4) {
        this.validateFormAndProceed();
        return;
      }

      this.proceedToNextStep();
    }
  }

  /**
   * Validate form data with server before proceeding to next step.
   * This calls the backend validation endpoint to check for errors.
   */
  private validateFormAndProceed(): void {
    if (this.isValidatingForm) return;

    this.isValidatingForm = true;

    this.snackBar.open(
      'Validating form data...',
      '',
      { duration: 2000, horizontalPosition: 'center', verticalPosition: 'top' }
    );

    this.apiService.validateExtractedData(this.patientForm.value).subscribe({
      next: (result) => {
        this.isValidatingForm = false;

        if (result.valid) {
          // Validation passed, proceed to next step
          this.proceedToNextStep();
        } else {
          // Show validation errors
          Object.entries(result.errors).forEach(([field, message]) => {
            const control = this.patientForm.get(field);
            if (control) {
              control.setErrors({ serverError: message });
              control.markAsTouched();
            }
          });

          // Show warning snackbar
          const errorCount = Object.keys(result.errors).length;
          this.snackBar.open(
            `Please fix ${errorCount} validation error${errorCount > 1 ? 's' : ''} before continuing.`,
            'OK',
            { duration: 5000, horizontalPosition: 'center', verticalPosition: 'top' }
          );
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isValidatingForm = false;
        console.error('>>> [MedicalBooking] Server validation error:', err);
        // If server validation fails, allow proceeding anyway (client validation passed)
        this.proceedToNextStep();
      }
    });
  }

  /**
   * Actually proceed to the next step (after validation passes or is skipped).
   */
  private proceedToNextStep(): void {
    this.isAnimating = true;
    this.animationDirection = 'forward';
    this.currentStep++;
    this.scrollToTop();

    // Pre-fill patient form when entering Step 4
    if (this.currentStep === 4) {
      // Pre-fill from OCR data if available
      if (this.ocrData && !this.uploadSkipped) {
        this.prefillPatientForm();
      }
      // Auto-fill email from logged-in user
      this.prefillEmailFromUser();
      // Focus on phone field after a brief delay for DOM to render
      setTimeout(() => {
        this.focusPhoneInput();
      }, 500);
    }

    // Confirm booking when entering Step 6
    if (this.currentStep === 6) {
      this.confirmBooking();
    }

    // Reset isAnimating after animation completes (350ms animation + buffer)
    setTimeout(() => {
      this.isAnimating = false;
    }, 400);
  }

  previousStep(): void {
    if (this.currentStep > 1 && !this.isAnimating) {
      this.isAnimating = true;
      this.animationDirection = 'backward';
      this.currentStep--;
      this.scrollToTop();

      // Reset isAnimating after animation completes
      setTimeout(() => {
        this.isAnimating = false;
      }, 400);
    }
  }

  goToStep(step: number): void {
    if (step < this.currentStep && !this.isAnimating) {
      this.isAnimating = true;
      this.animationDirection = 'backward';
      this.currentStep = step;
      this.scrollToTop();

      // Reset isAnimating after animation completes
      setTimeout(() => {
        this.isAnimating = false;
      }, 400);
    }
  }

  private scrollToTop(): void {
    // Scroll instantly to top so content renders at top position
    const bookingContainer = document.querySelector('.booking-container');
    if (bookingContainer) {
      bookingContainer.scrollTop = 0;
    }
    // Also scroll window to top
    window.scrollTo(0, 0);

    // Also scroll the step content container if it exists
    const stepContent = document.querySelector('.step-content');
    if (stepContent) {
      stepContent.scrollTop = 0;
    }
  }

  // Animation callback - kept for potential future use but timing is handled by setTimeout
  onAnimationDone(): void {
    // Animation completion is now handled by setTimeout in navigation methods
    // This callback can be used for additional post-animation logic if needed
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
      this.selectedTests = [];
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
      this.dropdownView = 'categories';
      this.selectedCategory = null;
      this.isDropdownAnimating = false;

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
      this.cdr.detectChanges(); // Force change detection after async update
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
            this.cdr.detectChanges(); // Force change detection after async update
            break;

          case 'processing':
            this.ocrProgress = 20 + ((response.data?.progress || 0) * 0.6);
            this.cdr.detectChanges(); // Force change detection after async update
            break;

          case 'completed':
            this.ocrProgress = 100;
            this.isProcessingOcr = false;
            this.ocrData = response.data?.extractedData || null;
            this.currentJobId = response.data?.jobId || null;
            this.cdr.detectChanges(); // Force change detection after async update
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
            this.cdr.detectChanges(); // Force change detection after async update
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
        this.cdr.detectChanges(); // Force change detection after async update
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
      this.cdr.detectChanges(); // Force change detection after async update
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
        this.cdr.detectChanges(); // Force change detection after async update
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
          this.cdr.detectChanges(); // Force change detection after async update
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
          this.cdr.detectChanges(); // Force change detection after async update
        }
      },
      error: (error) => {
        clearInterval(progressInterval);
        this.isProcessingInsurance = false;
        this.insuranceProgress = 0;
        this.insuranceError = error.message || 'Failed to process insurance card';
        this.cdr.detectChanges(); // Force change detection after async update
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
        // Parse date as local date to avoid timezone issues
        formUpdates['dob'] = this.parseDateAsLocal(this.ocrData.dob);
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

  /**
   * Pre-fill email from the logged-in user
   */
  private prefillEmailFromUser(): void {
    const user = this.authService.currentUser;
    if (user?.email && !this.patientForm.get('email')?.value) {
      this.patientForm.patchValue({ email: user.email });
    }
  }

  /**
   * Focus on the phone input field
   */
  private focusPhoneInput(): void {
    if (this.phoneInputRef?.nativeElement) {
      this.phoneInputRef.nativeElement.focus();
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
    const date = dob instanceof Date ? dob : this.parseDateAsLocal(dob);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Parse a date value as a local date to avoid timezone issues.
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

  // ===========================
  // Voice Assistant Methods
  // ===========================

  /**
   * Open the voice assistant modal
   */
  openVoiceAssistant(): void {
    console.log('>>> openVoiceAssistant() called, setting showVoiceAssistant = true');
    this.showVoiceAssistant = true;
    console.log('>>> showVoiceAssistant is now:', this.showVoiceAssistant);
    this.cdr.detectChanges();
    console.log('>>> cdr.detectChanges() called');
  }

  /**
   * Close the voice assistant modal
   */
  closeVoiceAssistant(): void {
    this.showVoiceAssistant = false;
  }

  /**
   * Handle booking data collected from voice assistant
   * Uses smart merge with confidence scoring to handle incremental updates
   */
  onVoiceBookingDataCollected(rawData: BookingFormData): void {
    console.log('Voice assistant data received:', rawData);
    const data = this.normalizeVoiceData(rawData);
    
    // Extract confidence scores if available (from VapiService)
    const confidence = rawData.confidence || {};
    
    // Smart merge: only update fields where confidence is higher than existing
    // or where user hasn't manually edited
    const mergedData = this.smartMergeVoiceData(data, confidence);
    
    this.voiceAssistantData = mergedData;
    
    // Apply and map all captured voice answers into the booking flow
    this.applyVoiceCapturedData(mergedData);

    // Update fields needing review based on confidence scores
    this.updateFieldsNeedingReview();

    // Close the voice assistant
    this.closeVoiceAssistant();
    
    // Show appropriate message based on confidence
    const lowConfidenceCount = this.fieldsNeedingReview.length;
    if (lowConfidenceCount > 0) {
      this.snackBar.open(
        `Form pre-filled. ${lowConfidenceCount} field(s) may need review (highlighted).`,
        'OK',
        {
          duration: 6000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: 'warning-snackbar'
        }
      );
    } else {
      this.snackBar.open(
        'Form pre-filled with your voice responses. Please review and complete.',
        'OK',
        {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        }
      );
    }
    
    // Navigate to the appropriate step based on what data was collected
    this.navigateToRelevantStep(mergedData);

    // Ensure we land on the patient details step with the captured answers
    if (this.currentStep < 4) {
      this.currentStep = 4;
      this.animationDirection = 'forward';
    }

    // Trigger post-call refinement in background if there are low-confidence fields
    // This will use Claude API to improve extraction accuracy
    if (lowConfidenceCount > 0) {
      setTimeout(() => {
        this.triggerPostCallRefinement();
      }, 500); // Small delay to let UI settle
    }
  }

  /**
   * Smart merge voice data with existing form data using confidence scores
   * 
   * Rules:
   * 1. User-edited fields are NEVER overwritten
   * 2. Higher confidence values win over lower confidence
   * 3. Non-empty values win over empty values
   */
  private smartMergeVoiceData(
    newData: BookingFormData, 
    newConfidence: { [key: string]: number }
  ): BookingFormData {
    const merged: BookingFormData = { ...newData };
    const currentFormValue = this.patientForm?.value || {};

    // Map of form fields to BookingFormData fields
    const fieldMapping: { [formField: string]: keyof BookingFormData } = {
      'firstName': 'firstName',
      'lastName': 'lastName',
      'dob': 'dob',
      'sex': 'sex',
      'addressStreet': 'addressStreet',
      'addressCity': 'addressCity',
      'addressState': 'addressState',
      'addressZip': 'addressZip',
      'email': 'email',
      'phone': 'phone',
      'insuranceProvider': 'insuranceProvider',
      'memberId': 'insuranceId'
    };

    for (const [formField, dataField] of Object.entries(fieldMapping)) {
      const existingValue = currentFormValue[formField];
      const newValue = (newData as any)[dataField];
      const existingConfidence = this.fieldConfidence[dataField] || 0;
      const newConf = newConfidence[dataField] || 0.7;

      // Rule 1: Never overwrite user-edited fields
      if (this.userEditedFields.has(formField)) {
        console.log(`🔒 [SmartMerge] Preserving user-edited field: ${formField}`);
        (merged as any)[dataField] = existingValue;
        continue;
      }

      // Rule 2: Skip if new value is empty
      if (newValue === undefined || newValue === null || newValue === '') {
        continue;
      }

      // Rule 3: Use new value if existing is empty
      if (!existingValue || existingValue === '') {
        (merged as any)[dataField] = newValue;
        this.fieldConfidence[dataField] = newConf;
        console.log(`📥 [SmartMerge] Using new value for ${dataField}: "${newValue}" (confidence: ${newConf.toFixed(2)})`);
        continue;
      }

      // Rule 4: Compare confidence scores
      if (newConf > existingConfidence) {
        (merged as any)[dataField] = newValue;
        this.fieldConfidence[dataField] = newConf;
        console.log(`⬆️ [SmartMerge] Upgrading ${dataField}: "${existingValue}" -> "${newValue}" (${existingConfidence.toFixed(2)} -> ${newConf.toFixed(2)})`);
      } else {
        console.log(`⬇️ [SmartMerge] Keeping existing ${dataField}: "${existingValue}" (confidence: ${existingConfidence.toFixed(2)} >= ${newConf.toFixed(2)})`);
      }
    }

    return merged;
  }

  /**
   * Update the list of fields that need user review (low confidence)
   */
  private updateFieldsNeedingReview(): void {
    const CONFIDENCE_THRESHOLD = 0.7;
    this.fieldsNeedingReview = [];

    for (const [field, confidence] of Object.entries(this.fieldConfidence)) {
      if (confidence < CONFIDENCE_THRESHOLD) {
        this.fieldsNeedingReview.push(field);
      }
    }

    console.log('Fields needing review:', this.fieldsNeedingReview);
  }

  /**
   * Check if a field needs review due to low confidence
   */
  fieldNeedsReview(fieldName: string): boolean {
    return this.fieldsNeedingReview.includes(fieldName);
  }

  /**
   * Get confidence level for a field (for UI display)
   */
  getFieldConfidence(fieldName: string): number {
    return this.fieldConfidence[fieldName] || 0;
  }

  /**
   * Mark a field as user-edited (prevents future voice overwrites)
   */
  markFieldAsUserEdited(fieldName: string): void {
    this.userEditedFields.add(fieldName);
    // Remove from needs review since user has manually verified
    const index = this.fieldsNeedingReview.indexOf(fieldName);
    if (index > -1) {
      this.fieldsNeedingReview.splice(index, 1);
    }
    // Set high confidence for user-edited fields
    this.fieldConfidence[fieldName] = 1.0;
  }

  /**
   * Pre-fill patient form with voice data
   */
  private prefillFromVoiceData(data: BookingFormData): void {
    const formUpdate: { [key: string]: any } = {};

    if (data.fullName && (!data.firstName || !data.lastName)) {
      const parts = data.fullName.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        formUpdate['firstName'] = parts[0];
        formUpdate['lastName'] = parts.slice(1).join(' ');
      }
    }
    if (data.firstName) formUpdate['firstName'] = data.firstName;
    if (data.lastName) formUpdate['lastName'] = data.lastName;
    if (data.dob) {
      // Try to parse the date
      const parsedDate = this.parseDateString(data.dob);
      if (parsedDate) {
        formUpdate['dob'] = parsedDate;
      }
    }
    if (data.sex) formUpdate['sex'] = data.sex;
    if (data.addressStreet) formUpdate['addressStreet'] = data.addressStreet;
    if (data.addressCity) formUpdate['addressCity'] = data.addressCity;
    if (data.addressState) formUpdate['addressState'] = data.addressState;
    if (data.addressZip) formUpdate['addressZip'] = data.addressZip;
    if (data.address) {
      const parsed = this.parseAddressString(data.address);
      if (parsed.street) formUpdate['addressStreet'] = parsed.street;
      if (parsed.city) formUpdate['addressCity'] = parsed.city;
      if (parsed.state) formUpdate['addressState'] = parsed.state;
      if (parsed.zip) formUpdate['addressZip'] = parsed.zip;
    }
    if (data.email) formUpdate['email'] = data.email;
    if (data.phone) {
      // Format phone number
      const formattedPhone = this.formatPhoneForForm(data.phone);
      formUpdate['phone'] = formattedPhone;
    }
    if (data.insuranceProvider) {
      // Map to form value
      const insuranceMap: { [key: string]: string } = {
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
      const normalizedProvider = data.insuranceProvider.toLowerCase();
      const matchedProvider = Object.keys(insuranceMap).find(key =>
        normalizedProvider.includes(key)
      );
      formUpdate['insuranceProvider'] = matchedProvider ? insuranceMap[matchedProvider] : 'other';
    }
    if (data.insuranceId) formUpdate['memberId'] = data.insuranceId;

    if (Object.keys(formUpdate).length > 0) {
      this.patientForm.patchValue(formUpdate);
      console.log('Patient form updated with voice data:', formUpdate);
    }
  }

  /**
   * Normalize and apply all captured voice answers into UI state and forms.
   */
  private applyVoiceCapturedData(data: BookingFormData): void {
    // Reset previous voice-specific helpers
    this.voicePreferredLocationText = null;
    this.voiceDateText = null;
    this.voiceTimeText = null;

    // Keep a copy of the reasons for display/submission
    this.voiceReasonForTest = data.reasons || null;

    // Pre-fill the patient form with collected data
    this.prefillFromVoiceData(data);
    
    // Handle tests (support multiple names separated by commas/and)
    if (data.test) {
      const tests = this.splitVoiceTests(data.test);
      if (tests.length > 0) {
        tests.forEach(name => this.addVoiceTestToSelection(name));
      }
    }
    
    // Handle date/time selection if provided
    if (data.preferredDate || data.preferredTime) {
      this.handleVoiceDateTimeSelection(data.preferredDate, data.preferredTime);
    }
    
    // Handle location selection if provided
    if (data.preferredLocation) {
      this.handleVoiceLocationSelection(data.preferredLocation);
    }

    // Move to patient details so the user can verify the mapped answers
    this.currentStep = Math.max(this.currentStep, 4);
    this.animationDirection = 'forward';
  }

  /**
   * Normalize common voice answers so they map cleanly into the booking form.
   */
  private normalizeVoiceData(data: BookingFormData): BookingFormData {
    const normalized: BookingFormData = { ...data };

    // Full name → first/last when needed
    if (normalized.fullName && (!normalized.firstName || !normalized.lastName)) {
      const parts = normalized.fullName.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        normalized.firstName = normalized.firstName || parts[0];
        normalized.lastName = normalized.lastName || parts.slice(1).join(' ');
      }
    }

    // Normalize sex to M/F
    if (normalized.sex) {
      normalized.sex = this.normalizeSex(normalized.sex);
    }

    // Location fallback field names
    if (!normalized.preferredLocation && (normalized as any).location) {
      normalized.preferredLocation = (normalized as any).location;
    }

    // If dateTime is provided, try to split it into date/time when missing
    if (normalized.dateTime) {
      const parts = normalized.dateTime.split(/(?:at|\s+-\s+|\s+)/i).map(p => p.trim()).filter(Boolean);
      if (!normalized.preferredDate && parts.length > 0) {
        normalized.preferredDate = parts[0];
      }
      if (!normalized.preferredTime && parts.length > 1) {
        normalized.preferredTime = parts.slice(1).join(' ');
      }
    }

    // Normalize phone number to digits
    if (normalized.phone) {
      normalized.phone = this.normalizePhoneNumber(normalized.phone);
    }

    // Lowercase email
    if (normalized.email) {
      normalized.email = normalized.email.trim().toLowerCase();
    }

    // Normalize insurance carrier
    if (normalized.insuranceProvider) {
      normalized.insuranceProvider = this.normalizeInsuranceProvider(normalized.insuranceProvider);
    }

    // If we only have address string, try to derive parts
    if (normalized.address && (!normalized.addressStreet || !normalized.addressCity || !normalized.addressState || !normalized.addressZip)) {
      const parsed = this.parseAddressString(normalized.address);
      normalized.addressStreet = normalized.addressStreet || parsed.street;
      normalized.addressCity = normalized.addressCity || parsed.city;
      normalized.addressState = normalized.addressState || parsed.state;
      normalized.addressZip = normalized.addressZip || parsed.zip;
    }

    return normalized;
  }

  /**
   * Handle test selection from voice input
   */
  private handleVoiceTestSelection(testName: string): void {
    const lowerTestName = testName.toLowerCase();
    
    // Find matching test(s)
    const matchingTests = this.medicalTests.filter(test =>
      test.name.toLowerCase().includes(lowerTestName) ||
      lowerTestName.includes(test.name.toLowerCase()) ||
      test.description.toLowerCase().includes(lowerTestName)
    );
    
    if (matchingTests.length > 0) {
      // Add matched tests to selection (avoid duplicates)
      for (const test of matchingTests) {
        if (!this.selectedTests.find(t => t.id === test.id)) {
          this.selectedTests.push(test);
        }
      }
      console.log('Voice test selection matched:', matchingTests.map(t => t.name));
    }
  }

  /**
   * Split a raw test answer into individual test names.
   */
  private splitVoiceTests(raw: string): string[] {
    if (!raw) return [];
    return raw
      .split(/(?:,| and | & )/i)
      .map(t => t.trim())
      .filter(Boolean);
  }

  /**
   * Add a test from voice input, creating a placeholder if we can't map it.
   */
  private addVoiceTestToSelection(testName: string): void {
    const lowerName = testName.toLowerCase();
    const existing = this.selectedTests.find(t => t.name.toLowerCase() === lowerName);
    if (existing) return;

    const match = this.medicalTests.find(test =>
      test.name.toLowerCase() === lowerName ||
      test.name.toLowerCase().includes(lowerName) ||
      lowerName.includes(test.name.toLowerCase()) ||
      test.description.toLowerCase().includes(lowerName)
    );

    if (match) {
      if (!this.selectedTests.find(t => t.id === match.id)) {
        this.selectedTests.push(match);
      }
      return;
    }

    // No match found: create a placeholder test entry so the user's intent is preserved
    const placeholderId = `voice-${this.slugify(testName)}`;
    if (!this.selectedTests.find(t => t.id === placeholderId)) {
      this.selectedTests.push({
        id: placeholderId,
        name: testName,
        description: 'Provided during voice call',
        category: 'blood',
        resultsTime: '',
        price: 0,
        icon: 'support_agent'
      });
    }
  }

  /**
   * Handle date/time selection from voice input
   */
  private handleVoiceDateTimeSelection(date?: string, time?: string): void {
    if (date) {
      const parsedDate = this.parseNaturalDateString(date) || this.parseDateString(date);
      if (parsedDate) {
        // Check if the date is available; if not, choose the next available weekday but keep the user's text
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const candidate = parsedDate < today ? today : parsedDate;
        const usableDate = this.getNextAvailableWeekday(candidate);
        this.selectedDate = usableDate;
        this.voiceDateText = date;
        this.generateCalendar();
      } else {
        this.voiceDateText = date;
      }
    }
    
    if (time) {
      const normalizedTime = time.toLowerCase().trim();
      this.voiceTimeText = time;

      // Try to match with available time slots
      const allSlots = [...this.morningSlots, ...this.afternoonSlots, ...this.eveningSlots];
      const matchingSlot = allSlots.find(slot => {
        const slotNormalized = slot.time.toLowerCase().replace(/\s/g, '');
        const requestedNormalized = normalizedTime.replace(/\s/g, '');
        return slot.available && (
          slotNormalized === requestedNormalized ||
          slot.time.toLowerCase().includes(normalizedTime)
        );
      });
      
      if (matchingSlot) {
        this.selectedTime = matchingSlot.time;
      } else {
        // Fallback: pick the first available slot in the morning/afternoon/evening
        if (normalizedTime.includes('morning')) {
          const slot = this.morningSlots.find(s => s.available);
          if (slot) this.selectedTime = slot.time;
        } else if (normalizedTime.includes('afternoon')) {
          const slot = this.afternoonSlots.find(s => s.available);
          if (slot) this.selectedTime = slot.time;
        } else if (normalizedTime.includes('evening')) {
          const slot = this.eveningSlots.find(s => s.available);
          if (slot) this.selectedTime = slot.time;
        } else {
          const firstAvailable = allSlots.find(s => s.available);
          if (firstAvailable) this.selectedTime = firstAvailable.time;
        }
      }
    }
  }

  /**
   * Handle location selection from voice input
   */
  private handleVoiceLocationSelection(locationName: string): void {
    const lowerLocationName = locationName.toLowerCase();
    this.voicePreferredLocationText = locationName;
    
    const matchingLocation = this.locations.find(loc => {
      const cityLower = loc.city.toLowerCase();
      const addressLower = loc.address.toLowerCase();
      return loc.name.toLowerCase().includes(lowerLocationName) ||
             lowerLocationName.includes(loc.name.toLowerCase()) ||
             cityLower.includes(lowerLocationName) ||
             addressLower.includes(lowerLocationName) ||
             lowerLocationName.includes(cityLower) ||
             lowerLocationName.includes(addressLower);
    });
    
    if (matchingLocation) {
      this.selectedLocation = matchingLocation;
      console.log('Voice location selection matched:', matchingLocation.name);
    }
  }

  /**
   * Navigate to the most relevant step based on collected data
   */
  private navigateToRelevantStep(data: BookingFormData): void {
    // If we have test info but no date, go to step 2
    if (data.test && this.selectedTests.length > 0 && !this.selectedDate) {
      this.currentStep = 2;
      return;
    }
    
    // If we have date/time but no ID upload, go to step 3
    if (this.selectedDate && this.selectedTime && !this.ocrData) {
      this.currentStep = 3;
      return;
    }
    
    // If we have personal info, go to step 4 (patient details)
    if (data.firstName || data.lastName || data.email || data.phone) {
      this.currentStep = 4;
      return;
    }
    
    // Default: stay on current step or go to step 1
    if (this.currentStep < 2 && this.selectedTests.length > 0) {
      this.currentStep = 2;
    }
  }

  /**
   * Normalize sex answers into a single-letter code.
   */
  private normalizeSex(sex: string): string {
    const lower = sex.toLowerCase().trim();
    if (['male', 'm', 'man'].includes(lower)) return 'M';
    if (['female', 'f', 'woman'].includes(lower)) return 'F';
    return sex;
  }

  /**
   * Normalize phone numbers to digits-only (returns raw digits; formatting applied later).
   */
  private normalizePhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return digits.slice(1);
    }
    if (digits.length >= 10) {
      return digits.slice(0, 10);
    }
    return digits || phone;
  }

  /**
   * Map common carrier names to the select options we support.
   */
  private normalizeInsuranceProvider(provider: string): string {
    const normalized = provider.toLowerCase();
    const map: { [key: string]: string } = {
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
      'kaiser permanente': 'kaiser',
      'self': 'self'
    };

    const matchKey = Object.keys(map).find(key => normalized.includes(key));
    return matchKey ? map[matchKey] : provider;
  }

  /**
   * Parse natural language dates like "next Monday", "tomorrow", "today".
   */
  private parseNaturalDateString(dateStr: string): Date | null {
    if (!dateStr) return null;
    const lower = dateStr.toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (lower.includes('today')) {
      return today;
    }

    if (lower.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow;
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const nextMatch = lower.match(/next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/);
    const thisMatch = lower.match(/this\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/);
    const dayMatch = nextMatch || thisMatch || lower.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);

    if (dayMatch && dayMatch[1]) {
      const targetDay = dayNames.indexOf(dayMatch[1]);
      const currentDay = today.getDay();
      let daysAhead = targetDay - currentDay;
      if (daysAhead <= 0 || nextMatch) {
        daysAhead += 7;
      }
      const result = new Date(today);
      result.setDate(today.getDate() + daysAhead);
      return result;
    }

    return null;
  }

  /**
   * Pick the next weekday (Mon-Fri) that is not in the past.
   */
  private getNextAvailableWeekday(startDate: Date): Date {
    const date = new Date(startDate);
    date.setHours(0, 0, 0, 0);
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  /**
   * Slugify helper for placeholder test IDs.
   */
  private slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  /**
   * Parse a date string into a Date object
   */
  private parseDateString(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    const cleanedStr = dateStr.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
    
    // Try various date formats
    const formats = [
      // MM/DD/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // MM/DD/YY
      /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
      // Month DD, YYYY
      /^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/,
    ];
    
    for (const format of formats) {
      const match = cleanedStr.match(format);
      if (match) {
        if (format === formats[0]) {
          // MM/DD/YYYY
          return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
        } else if (format === formats[1]) {
          // MM/DD/YY
          const year = parseInt(match[3]) + 2000;
          return new Date(year, parseInt(match[1]) - 1, parseInt(match[2]));
        } else if (format === formats[2]) {
          // Month DD, YYYY
          const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'];
          const monthIndex = monthNames.indexOf(match[1].toLowerCase());
          if (monthIndex >= 0) {
            return new Date(parseInt(match[3]), monthIndex, parseInt(match[2]));
          }
        }
      }
    }
    
    // Try native Date parsing as fallback
    const parsed = new Date(cleanedStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Split a raw address string into components for the booking form.
   * Keeps things lenient to handle imperfect voice answers.
   */
  private parseAddressString(address: string): { street?: string; city?: string; state?: string; zip?: string } {
    const result: { street?: string; city?: string; state?: string; zip?: string } = {};
    if (!address) return result;

    let working = address.trim();

    // Extract ZIP
    const zipMatch = working.match(/\b(\d{5}(?:-\d{4})?)\b/);
    if (zipMatch) {
      result.zip = zipMatch[1];
      working = working.replace(zipMatch[0], '').trim();
    }

    // Extract state (2-letter or spelled out)
    const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
    const stateNames: Record<string, string> = {
      'alabama': 'AL','alaska': 'AK','arizona': 'AZ','arkansas': 'AR','california': 'CA','colorado': 'CO','connecticut': 'CT','delaware': 'DE','florida': 'FL','georgia': 'GA','hawaii': 'HI','idaho': 'ID','illinois': 'IL','indiana': 'IN','iowa': 'IA','kansas': 'KS','kentucky': 'KY','louisiana': 'LA','maine': 'ME','maryland': 'MD','massachusetts': 'MA','michigan': 'MI','minnesota': 'MN','mississippi': 'MS','missouri': 'MO','montana': 'MT','nebraska': 'NE','nevada': 'NV','new hampshire': 'NH','new jersey': 'NJ','new mexico': 'NM','new york': 'NY','north carolina': 'NC','north dakota': 'ND','ohio': 'OH','oklahoma': 'OK','oregon': 'OR','pennsylvania': 'PA','rhode island': 'RI','south carolina': 'SC','south dakota': 'SD','tennessee': 'TN','texas': 'TX','utah': 'UT','vermont': 'VT','virginia': 'VA','washington': 'WA','west virginia': 'WV','wisconsin': 'WI','wyoming': 'WY'
    };

    for (const state of states) {
      const stateRegex = new RegExp(`\\b${state}\\b`, 'i');
      if (stateRegex.test(working)) {
        result.state = state;
        working = working.replace(stateRegex, '').trim();
        break;
      }
    }

    if (!result.state) {
      for (const [name, abbr] of Object.entries(stateNames)) {
        const stateRegex = new RegExp(`\\b${name}\\b`, 'i');
        if (stateRegex.test(working)) {
          result.state = abbr;
          working = working.replace(stateRegex, '').trim();
          break;
        }
      }
    }

    // Split remaining by comma
    const parts = working.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      result.street = parts[0];
      result.city = parts[1];
    } else if (parts.length === 1) {
      if (/^\d+\s+/.test(parts[0])) {
        result.street = parts[0];
      } else {
        result.city = parts[0];
      }
    }

    return result;
  }

  /**
   * Format phone number for form
   */
  private formatPhoneForForm(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length >= 10) {
      const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1, 11) : digits.slice(0, 10);
      return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
    }
    
    return phone;
  }
}
