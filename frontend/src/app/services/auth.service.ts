import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthResponse {
  user?: User;
  session?: Session;
  error?: { message: string };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:3220/api/auth';

  private authState = new BehaviorSubject<AuthState>({
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: true
  });

  public authState$ = this.authState.asObservable();
  public user$ = this.authState$.pipe(map(state => state.user));
  public isAuthenticated$ = this.authState$.pipe(map(state => state.isAuthenticated));
  public isLoading$ = this.authState$.pipe(map(state => state.isLoading));

  constructor(private http: HttpClient) {
    // Check session on service initialization
    this.checkSession();
  }

  /**
   * Check if user has an active session
   */
  async checkSession(): Promise<void> {
    try {
      const response = await this.http.get<AuthResponse>(
        `${this.API_URL}/get-session`,
        { withCredentials: true }
      ).toPromise();

      if (response?.user && response?.session) {
        this.authState.next({
          user: response.user,
          session: response.session,
          isAuthenticated: true,
          isLoading: false
        });
      } else {
        this.authState.next({
          user: null,
          session: null,
          isAuthenticated: false,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('Session check failed:', error);
      this.authState.next({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, name?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.http.post<AuthResponse>(
        `${this.API_URL}/sign-up/email`,
        { email, password, name: name || email.split('@')[0] },
        { withCredentials: true }
      ).toPromise();

      if (response?.error) {
        return { success: false, error: response.error.message };
      }

      // Refresh session after signup
      await this.checkSession();
      return { success: true };
    } catch (error: any) {
      const message = error?.error?.message || error?.message || 'Sign up failed';
      return { success: false, error: message };
    }
  }

  /**
   * Sign in with social provider (Google, Facebook, Apple)
   * Better-Auth expects a POST request that returns a redirect URL
   */
  async signInWithSocial(provider: 'google' | 'facebook' | 'apple'): Promise<void> {
    try {
      const callbackURL = `${window.location.origin}/book-test`;
      
      // Make POST request to get the OAuth redirect URL
      const response = await this.http.post<{ url?: string; redirect?: boolean }>(
        `${this.API_URL}/sign-in/social`,
        { 
          provider,
          callbackURL 
        },
        { withCredentials: true }
      ).toPromise();

      // Better-Auth returns the redirect URL in the response
      if (response?.url) {
        window.location.href = response.url;
      }
    } catch (error: any) {
      // If the request returns a redirect status, follow it
      // Some implementations redirect directly from the POST
      console.error('Social sign-in error:', error);
      
      // Fallback: try direct navigation to the OAuth endpoint
      const callbackURL = encodeURIComponent(`${window.location.origin}/book-test`);
      window.location.href = `${this.API_URL}/sign-in/social?provider=${provider}&callbackURL=${callbackURL}`;
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string, rememberMe: boolean = true): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.http.post<AuthResponse>(
        `${this.API_URL}/sign-in/email`,
        { email, password, rememberMe },
        { withCredentials: true }
      ).toPromise();

      if (response?.error) {
        return { success: false, error: response.error.message };
      }

      // Refresh session after signin
      await this.checkSession();
      return { success: true };
    } catch (error: any) {
      const message = error?.error?.message || error?.message || 'Sign in failed';
      return { success: false, error: message };
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      await this.http.post(
        `${this.API_URL}/sign-out`,
        {},
        { withCredentials: true }
      ).toPromise();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      this.authState.next({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  }

  /**
   * Get current user synchronously
   */
  get currentUser(): User | null {
    return this.authState.getValue().user;
  }

  /**
   * Check if user is authenticated synchronously
   */
  get isAuthenticated(): boolean {
    return this.authState.getValue().isAuthenticated;
  }
}
