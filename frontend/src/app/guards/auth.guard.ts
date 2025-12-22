import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.authService.authState$.pipe(
      take(1),
      map(state => {
        // If still loading, allow access (will be handled by component)
        if (state.isLoading) {
          return true;
        }

        if (state.isAuthenticated) {
          return true;
        }

        // Redirect to login page
        return this.router.createUrlTree(['/login']);
      })
    );
  }
}
