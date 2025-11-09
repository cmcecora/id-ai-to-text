import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UploadPageComponent } from './upload-page/upload-page.component';

const routes: Routes = [
  { path: 'id-upload', component: UploadPageComponent },
  { path: '', redirectTo: '/id-upload', pathMatch: 'full' },
  { path: '**', redirectTo: '/id-upload' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
