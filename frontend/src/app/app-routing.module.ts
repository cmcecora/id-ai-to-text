import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UploadPageComponent } from './upload-page/upload-page.component';
import { MedicalBookingComponent } from './medical-booking/medical-booking.component';
import { TestSearchComponent } from './test-search/test-search.component';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', component: TestSearchComponent },
  { path: 'search', component: TestSearchComponent },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'book-test', component: MedicalBookingComponent, canActivate: [AuthGuard] },
  { path: 'id-upload', component: UploadPageComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
