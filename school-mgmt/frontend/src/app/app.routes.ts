import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { Role } from './models/role.enum';
import { erpLaunchClusterContent } from './content/erp-launch';

const ALL_ROLES = Object.values(Role) as Role[];
const NON_SHAREHOLDER_ROLES = ALL_ROLES.filter((role) => role !== Role.SHAREHOLDER) as Role[];
const INVESTOR_ROLES = [Role.DIRECTOR, Role.SHAREHOLDER];
const REPORT_ACCESS_ROLES = [Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.SALE, Role.SHAREHOLDER];
const ERP_LAUNCH_PUBLIC_ROUTES: Routes = erpLaunchClusterContent.publicLinks.map(({ slug }) => ({
  path: `lp/${slug}`,
  loadComponent: () =>
    import('./components/landing-pages/erp-launch-landing/erp-launch-landing.component').then((m) => m.ErpLaunchLandingComponent),
  data: { erpLaunchSlug: slug },
}));

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'not-authorized',
    loadComponent: () =>
      import('./components/not-authorized.component').then((m) => m.NotAuthorizedComponent),
  },
  {
    path: 'student-attendance/:token',
    loadComponent: () =>
      import('./components/student-attendance.component').then((m) => m.StudentAttendanceComponent),
  },
  {
    path: 'co-dong',
    loadComponent: () =>
      import('./components/landing-pages/shareholder-collaboration-landing.component').then((m) => m.ShareholderCollaborationLandingComponent),
  },
  ...ERP_LAUNCH_PUBLIC_ROUTES,
  {
    path: 'lp/:slug',
    loadComponent: () =>
      import('./components/landing-pages/public-landing-page.component').then((m) => m.PublicLandingPageComponent),
  },
  {
    path: 'tuyen-dung-giao-vien',
    loadComponent: () =>
      import('./components/landing-pages/public-teacher-recruitment.component').then((m) => m.PublicTeacherRecruitmentComponent),
  },
  {
    path: 'app',
    loadComponent: () =>
      import('./components/app-shell.component').then((m) => m.AppShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/dashboards/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'investor-dashboard',
        canActivate: [roleGuard(INVESTOR_ROLES)],
        loadComponent: () =>
          import('./components/dashboards/investor-dashboard.component').then((m) => m.InvestorDashboardComponent),
      },
      {
        path: 'users',
        canActivate: [roleGuard([Role.DIRECTOR, Role.SALE])],
        loadComponent: () =>
          import('./components/users-management.component').then((m) => m.UsersManagementComponent),
      },
      {
        path: 'products',
        canActivate: [roleGuard([Role.DIRECTOR])],
        loadComponent: () =>
          import('./components/products.component').then((m) => m.ProductsComponent),
      },
      {
        path: 'students',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.SALE])],
        loadComponent: () =>
          import('./components/students.component').then((m) => m.StudentsComponent),
      },
      {
        path: 'classes',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.SALE, Role.ACCOUNTING])],
        loadComponent: () =>
          import('./components/classes.component').then((m) => m.ClassesComponent),
      },
      {
        path: 'sessions',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.PARENT, Role.ACCOUNTING, Role.SALE])],
        loadComponent: () =>
          import('./components/sessions.component').then((m) => m.SessionsComponent),
      },
      {
        path: 'attendance',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.TEACHER])],
        loadComponent: () =>
          import('./components/attendance.component').then((m) => m.AttendanceComponent),
      },
      {
        path: 'attendance-report',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.TEACHER])],
        loadComponent: () =>
          import('./components/attendance-report.component').then((m) => m.AttendanceReportComponent),
      },
      {
        path: 'student-report',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING])],
        loadComponent: () =>
          import('./components/student-report.component').then((m) => m.StudentReportComponent),
      },
      {
        path: 'comprehensive-report',
        canActivate: [roleGuard(REPORT_ACCESS_ROLES)],
        loadComponent: () =>
          import('./components/comprehensive-report.component').then((m) => m.ComprehensiveReportComponent),
      },
      {
        path: 'teaching-report',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.TEACHER, Role.ACCOUNTING, Role.SHAREHOLDER])],
        loadComponent: () =>
          import('./components/teaching-report.component').then((m) => m.TeachingReportComponent),
      },
      {
        path: 'invoices',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE])],
        loadComponent: () =>
          import('./components/invoices.component').then((m) => m.InvoicesComponent),
      },
      {
        path: 'wallets',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.PARENT])],
        loadComponent: () =>
          import('./components/wallets.component').then((m) => m.WalletsComponent),
      },
      {
        path: 'payroll',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.TEACHER])],
        loadComponent: () =>
          import('./components/payroll.component').then((m) => m.PayrollComponent),
      },
      {
        path: 'tickets',
        canActivate: [roleGuard(NON_SHAREHOLDER_ROLES)],
        loadComponent: () =>
          import('./components/tickets.component').then((m) => m.TicketsComponent),
      },
      {
        path: 'teacher-profile',
        canActivate: [roleGuard([Role.TEACHER])],
        loadComponent: () =>
          import('./components/teacher-profile.component').then((m) => m.TeacherProfileComponent),
      },
      {
        path: 'teaching-materials',
        canActivate: [roleGuard(NON_SHAREHOLDER_ROLES)],
        loadComponent: () =>
          import('./components/teaching-materials.component').then((m) => m.TeachingMaterialsComponent),
      },
      {
        path: 'teacher-hub',
        canActivate: [roleGuard([Role.TEACHER])],
        loadComponent: () =>
          import('./components/teacher-guide-landing.component').then((m) => m.TeacherGuideLandingComponent),
      },
      {
        path: 'sale-hub',
        canActivate: [roleGuard([Role.DIRECTOR, Role.SALE])],
        loadComponent: () =>
          import('./components/sale-guide-landing.component').then((m) => m.SaleGuideLandingComponent),
      },
      {
        path: 'pending-approvals',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS])],
        loadComponent: () =>
          import('./components/pending-approvals.component').then((m) => m.PendingApprovalsComponent),
      },
      {
        path: 'notifications',
        canActivate: [roleGuard(NON_SHAREHOLDER_ROLES)],
        loadComponent: () =>
          import('./components/notifications.component').then((m) => m.NotificationsComponent),
      },
      {
        path: 'audit-log',
        canActivate: [roleGuard([Role.DIRECTOR])],
        loadComponent: () =>
          import('./components/audit-log.component').then((m) => m.AuditLogComponent),
      },
      {
        path: 'export-reports',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING])],
        loadComponent: () =>
          import('./components/export-reports.component').then((m) => m.ExportReportsComponent),
      },
      {
        path: 'teacher-kpi',
        canActivate: [roleGuard([Role.DIRECTOR])],
        loadComponent: () =>
          import('./components/teacher-kpi.component').then((m) => m.TeacherKpiComponent),
      },
      {
        path: 'calendar-overview',
        canActivate: [roleGuard([Role.DIRECTOR])],
        loadComponent: () =>
          import('./components/calendar-overview.component').then((m) => m.CalendarOverviewComponent),
      },
      {
        path: 'teacher-profiles',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.SALE])],
        loadComponent: () =>
          import('./components/teacher-profiles.component').then((m) => m.TeacherProfilesComponent),
      },
      {
        path: 'teacher-profiles/:id',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.SALE])],
        loadComponent: () =>
          import('./components/teacher-profiles.component').then((m) => m.TeacherProfilesComponent),
      },
      {
        path: 'teacher-registrations',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS])],
        loadComponent: () =>
          import('./components/teacher-registrations.component').then((m) => m.TeacherRegistrationsComponent),
      },
      {
        path: 'teacher-registrations/:id',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS])],
        loadComponent: () =>
          import('./components/teacher-registrations.component').then((m) => m.TeacherRegistrationsComponent),
      },
      {
        path: 'leads',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.SALE])],
        loadComponent: () =>
          import('./components/leads.component').then((m) => m.LeadsComponent),
      },
      {
        path: 'orders',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.SALE])],
        loadComponent: () =>
          import('./components/orders.component').then((m) => m.OrdersComponent),
      },
      {
        path: 'trial-enrollments',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.SALE])],
        loadComponent: () =>
          import('./components/trial-enrollments.component').then((m) => m.TrialEnrollmentsComponent),
      },
      {
        path: 'work-sessions',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.TEACHER, Role.SALE])],
        loadComponent: () =>
          import('./components/work-sessions.component').then((m) => m.WorkSessionsComponent),
      },
      {
        path: 'salary-config',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING])],
        loadComponent: () =>
          import('./components/salary-config.component').then((m) => m.SalaryConfigComponent),
      },
      {
        path: 'staff-payroll',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS])],
        loadComponent: () =>
          import('./components/staff-payroll.component').then((m) => m.StaffPayrollComponent),
      },
      {
        path: 'expenses',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS])],
        loadComponent: () =>
          import('./components/expenses.component').then((m) => m.ExpensesComponent),
      },
      {
        path: 'loans',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.SHAREHOLDER])],
        loadComponent: () =>
          import('./components/loans.component').then((m) => m.LoansComponent),
      },
      {
        path: 'financial-control',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.SHAREHOLDER])],
        loadComponent: () =>
          import('./components/financial-control.component').then((m) => m.FinancialControlComponent),
      },
      {
        path: 'ads-management',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.ADSMANAGER])],
        loadComponent: () =>
          import('./components/ads-management.component').then((m) => m.AdsManagementComponent),
      },
      {
        path: 'ads-analytics',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.ADSMANAGER, Role.SHAREHOLDER])],
        loadComponent: () =>
          import('./components/ads-analytics.component').then((m) => m.AdsAnalyticsComponent),
      },
      {
        path: 'landing-pages',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.SALE])],
        loadComponent: () =>
          import('./components/landing-pages/landing-pages-management.component').then((m) => m.LandingPagesManagementComponent),
      },
      {
        path: 'conversations',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.SALE])],
        loadComponent: () =>
          import('./components/conversations.component').then((m) => m.ConversationsComponent),
      },
      {
        path: 'chatbot-settings',
        canActivate: [roleGuard([Role.DIRECTOR, Role.OPS, Role.ADSMANAGER])],
        loadComponent: () =>
          import('./components/chatbot-settings.component').then((m) => m.ChatbotSettingsComponent),
      },
      {
        path: 'student-progress',
        canActivate: [roleGuard([Role.PARENT])],
        loadComponent: () =>
          import('./components/student-progress.component').then((m) => m.StudentProgressComponent),
      },
      {
        path: 'parent-attendance',
        canActivate: [roleGuard([Role.PARENT])],
        loadComponent: () =>
          import('./components/parent-attendance.component').then((m) => m.ParentAttendanceComponent),
      },
      {
        path: 'parent-invoices',
        canActivate: [roleGuard([Role.PARENT])],
        loadComponent: () =>
          import('./components/parent-invoices.component').then((m) => m.ParentInvoicesComponent),
      },
      {
        path: 'commission-report',
        canActivate: [roleGuard([Role.DIRECTOR, Role.SALE, Role.ACCOUNTING])],
        loadComponent: () =>
          import('./components/commission-report.component').then((m) => m.CommissionReportComponent),
      },
      {
        path: 'aging-report',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.SHAREHOLDER])],
        loadComponent: () =>
          import('./components/aging-report.component').then((m) => m.AgingReportComponent),
      },
      {
        path: 'parent-calendar',
        canActivate: [roleGuard([Role.PARENT])],
        loadComponent: () =>
          import('./components/parent-calendar.component').then((m) => m.ParentCalendarComponent),
      },
      {
        path: 'teacher-calendar',
        canActivate: [roleGuard([Role.TEACHER])],
        loadComponent: () =>
          import('./components/teacher-calendar.component').then((m) => m.TeacherCalendarComponent),
      },
      {
        path: 'teacher-substitute-request',
        canActivate: [roleGuard([Role.TEACHER])],
        loadComponent: () =>
          import('./components/teacher-substitute-request.component').then((m) => m.TeacherSubstituteRequestComponent),
      },
      {
        path: 'employee-performance',
        canActivate: [roleGuard([Role.DIRECTOR])],
        loadComponent: () =>
          import('./components/employee-performance.component').then((m) => m.EmployeePerformanceComponent),
      },
      {
        path: 'bank-reconciliation',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING])],
        loadComponent: () =>
          import('./components/bank-reconciliation.component').then((m) => m.BankReconciliationComponent),
      },
      {
        path: 'messages',
        canActivate: [roleGuard(NON_SHAREHOLDER_ROLES)],
        loadComponent: () =>
          import('./components/messages.component').then((m) => m.MessagesComponent),
      },
      {
        path: 'parent-chat',
        canActivate: [roleGuard([Role.PARENT])],
        loadComponent: () =>
          import('./components/parent-support-chat.component').then((m) => m.ParentSupportChatComponent),
      },
      {
        path: 'internal-handbook',
        canActivate: [roleGuard(NON_SHAREHOLDER_ROLES)],
        loadComponent: () =>
          import('./components/internal-handbook.component').then((m) => m.InternalHandbookComponent),
      },
      {
        path: 'supplier-quotes',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS])],
        loadComponent: () =>
          import('./components/supplier-quotes.component').then((m) => m.SupplierQuotesComponent),
      },
      {
        path: 'payments/supplier',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS])],
        loadComponent: () =>
          import('./components/supplier-payments.component').then((m) => m.SupplierPaymentsComponent),
      },
      {
        path: 'agents',
        canActivate: [roleGuard([Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.SALE])],
        loadComponent: () =>
          import('./components/agents.component').then((m) => m.AgentsComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
