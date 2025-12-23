import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: false,
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent implements OnInit {
  signupForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  hidePassword = true;
  hideConfirmPassword = true;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.signupForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    // Redirect if already authenticated
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/book-test']);
    }
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    return null;
  }

  async onSubmit(): Promise<void> {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.signupForm.value;

    const result = await this.authService.signUp(email, password);

    this.isLoading = false;

    if (result.success) {
      this.router.navigate(['/book-test']);
    } else {
      this.errorMessage = result.error || 'Sign up failed. Please try again.';
    }
  }

  signInWithGoogle(): void {
    this.authService.signInWithSocial('google');
  }

  signInWithFacebook(): void {
    this.authService.signInWithSocial('facebook');
  }

  signInWithApple(): void {
    this.authService.signInWithSocial('apple');
  }

  getEmailError(): string {
    const email = this.signupForm.get('email');
    if (email?.hasError('required')) {
      return 'Email is required';
    }
    if (email?.hasError('email')) {
      return 'Please enter a valid email address';
    }
    return '';
  }

  getPasswordError(): string {
    const password = this.signupForm.get('password');
    if (password?.hasError('required')) {
      return 'Password is required';
    }
    if (password?.hasError('minlength')) {
      return 'Password must be at least 8 characters';
    }
    return '';
  }

  getConfirmPasswordError(): string {
    const confirmPassword = this.signupForm.get('confirmPassword');
    if (confirmPassword?.hasError('required')) {
      return 'Please confirm your password';
    }
    if (confirmPassword?.hasError('passwordMismatch')) {
      return 'Passwords do not match';
    }
    return '';
  }
}
