import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { ApiService } from './api.service';

export const RoleGuard: (allowed: string[]) => CanActivateFn = (allowed: string[]) => {
  return () => {
    const api = inject(ApiService);
    const router = inject(Router);
    const role = api.getRole();
    if (!role) return router.parseUrl('/');
    if (allowed.length === 0) return true;
    if (allowed.includes(role)) return true;
    return router.parseUrl('/');
  };
};
