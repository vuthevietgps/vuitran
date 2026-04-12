import { Injectable } from '@angular/core';
import { Role } from '../models/role.enum';

type Loader = () => Promise<unknown>;
type ConnectionLike = {
  saveData?: boolean;
  effectiveType?: string;
};
type NavigatorWithConnection = Navigator & {
  connection?: ConnectionLike;
  mozConnection?: ConnectionLike;
  webkitConnection?: ConnectionLike;
};

const PREFETCH_LOADERS: Partial<Record<Role, Loader[]>> = {
  [Role.DIRECTOR]: [
    () => import('../components/tickets.component'),
    () => import('../components/messages.component'),
    () => import('../components/students.component'),
    () => import('../components/teacher-registrations.component'),
  ],
  [Role.ACCOUNTING]: [
    () => import('../components/invoices.component'),
    () => import('../components/financial-control.component'),
    () => import('../components/tickets.component'),
  ],
  [Role.OPS]: [
    () => import('../components/students.component'),
    () => import('../components/classes.component'),
    () => import('../components/messages.component'),
    () => import('../components/teacher-registrations.component'),
  ],
  [Role.TEACHER]: [
    () => import('../components/sessions.component'),
    () => import('../components/teacher-calendar.component'),
    () => import('../components/teaching-materials.component'),
  ],
  [Role.PARENT]: [
    () => import('../components/student-progress.component'),
    () => import('../components/parent-support-chat.component'),
    () => import('../components/parent-calendar.component'),
  ],
  [Role.SALE]: [
    () => import('../components/leads.component'),
    () => import('../components/orders.component'),
    () => import('../components/messages.component'),
    () => import('../components/sale-guide-landing.component'),
  ],
  [Role.ADSMANAGER]: [
    () => import('../components/ads-management.component'),
    () => import('../components/ads-analytics.component'),
    () => import('../components/chatbot-settings.component'),
  ],
};

@Injectable({ providedIn: 'root' })
export class RoutePrefetchService {
  private readonly warmedRoles = new Set<Role>();

  warmForRole(role?: string | null): void {
    const resolvedRole = role as Role | undefined;
    if (!resolvedRole || this.warmedRoles.has(resolvedRole) || !this.canPrefetch()) {
      return;
    }

    const loaders = PREFETCH_LOADERS[resolvedRole];
    if (!loaders?.length) {
      return;
    }

    this.warmedRoles.add(resolvedRole);
    this.schedule(() => {
      void Promise.allSettled(loaders.map((load) => load()));
    });
  }

  private schedule(task: () => void): void {
    if (typeof window === 'undefined') {
      task();
      return;
    }

    const idleCapableWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };

    if (typeof idleCapableWindow.requestIdleCallback === 'function') {
      idleCapableWindow.requestIdleCallback(task, { timeout: 2500 });
      return;
    }

    window.setTimeout(task, 1200);
  }

  private canPrefetch(): boolean {
    if (typeof navigator === 'undefined') {
      return true;
    }

    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    if (!connection) {
      return true;
    }

    if (connection.saveData) {
      return false;
    }

    return !['slow-2g', '2g'].includes(connection.effectiveType ?? '');
  }
}
