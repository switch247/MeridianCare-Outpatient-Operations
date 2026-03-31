import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

export const RoleGuard: (allowed: string[]) => CanActivateFn = (allowed: string[]) => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) return router.parseUrl('/');
    const role = auth.getRole();
    if (!role) return router.parseUrl('/');
    if (allowed.length === 0) return true;
    if (allowed.includes(role)) return true;
    return router.parseUrl('/');
  };
};
