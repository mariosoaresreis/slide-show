import { Routes } from '@angular/router';
import { environment } from '@env/environment';
import { SlideshowComponent } from './features/slideshow/slideshow.component';

const demoProfileId = environment.demoProfileId;

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: `profiles/${demoProfileId}` },
  { path: 'profiles/:profileId', component: SlideshowComponent },
  { path: '**', redirectTo: `profiles/${demoProfileId}` },
];

