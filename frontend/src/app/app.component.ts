import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from './services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'frontend';
  user$: Observable<User | null>;
  isAuthenticated$: Observable<boolean>;
  isLoading$: Observable<boolean>;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.user$ = this.authService.user$;
    this.isAuthenticated$ = this.authService.isAuthenticated$;
    this.isLoading$ = this.authService.isLoading$;
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }
}
