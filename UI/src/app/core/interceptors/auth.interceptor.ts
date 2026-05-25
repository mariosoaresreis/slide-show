import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '@env/environment';
import { AuthService } from '../services/auth.service';

function isApiRequest(url: string): boolean {
  if (/^https?:\/\//i.test(url)) {
    return environment.apiBaseUrl.startsWith('http') && url.startsWith(environment.apiBaseUrl);
  }
  return url.startsWith(environment.apiBaseUrl);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }

  const token = inject(AuthService).token();
  if (!token) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

