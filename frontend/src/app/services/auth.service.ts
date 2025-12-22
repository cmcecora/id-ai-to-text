import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { authClient } from '../../auth';

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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
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

  constructor() {
    // Check session on service initialization
    this.checkSession();
  }

  /**
   * Check if user has an active session
   */
  async checkSession(): Promise<void> {
    try {
      const { data, error } = await authClient.getSession();

      if (error || !data) {
        this.authState.next({
          user: null,
          session: null,
          isAuthenticated: false,
          isLoading: false
        });
        return;
      }

      this.authState.next({
        user: data.user as User,
        session: data.session as Session,
        isAuthenticated: true,
        isLoading: false
      });
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
  async signUp(email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Refresh session after signup
      await this.checkSession();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Sign up failed' };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string, rememberMe: boolean = true): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
        rememberMe
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Refresh session after signin
      await this.checkSession();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Sign in failed' };
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      await authClient.signOut();
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
