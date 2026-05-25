import { Injectable } from '@angular/core';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'bumble-photo-jwt';

  token(): string | null {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(this.storageKey)?.trim();
      if (stored) {
        return stored;
      }
    }
    return environment.devBearerToken ?? null;
  }

  setToken(token: string | null): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    if (!token) {
      localStorage.removeItem(this.storageKey);
      return;
    }

    localStorage.setItem(this.storageKey, token);
  }

  clear(): void {
    this.setToken(null);
  }
}

