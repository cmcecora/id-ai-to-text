import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UploadPageComponent } from './upload-page/upload-page.component';
import { MedicalBookingComponent } from './medical-booking/medical-booking.component';
import { TestSearchComponent } from './test-search/test-search.component';

const routes: Routes = [
  { path: '', component: TestSearchComponent },
  { path: 'search', component: TestSearchComponent },
  { path: 'book-test', component: MedicalBookingComponent },
  { path: 'id-upload', component: UploadPageComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
