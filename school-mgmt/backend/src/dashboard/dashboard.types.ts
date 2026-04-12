import { Role } from '../common/interfaces/role.enum';

// ─── Interface definitions for dashboard responses ──────────────────

export interface DirectorDashboard {
  overview: {
    totalRevenue: number;
    totalTeacherCost: number;
    totalExpenses: number;
    grossProfit: number;
    netProfit: number;
    profitMargin: number;
  };
  sessions: {
    total: number;
    byStatus: Record<string, number>;
    completionRate: number;
  };
  users: {
    totalTeachers: number;
    activeTeachers: number;
    totalParents: number;
    totalStudents: number;
  };
  payroll: {
    totalPaid: number;
    pendingApproval: number;
    byStatus: Record<string, { count: number; totalNet: number }>;
  };
  tickets: {
    total: number;
    openCount: number;
    overdueCount: number;
    avgResolutionHours: number | null;
  };
  wallets: {
    totalBalance: number;
    totalTopUp: number;
    totalDeducted: number;
    totalRefunded: number;
  };
  recentActivity: {
    recentSessions: any[];
    recentTickets: any[];
    recentTopUps: any[];
  };
}

export interface AccountingDashboard {
  financialSummary: Record<string, { totalAmount: number; count: number }>;
  wallets: {
    totalBalance: number;
    totalTopUp: number;
    totalDeducted: number;
    totalRefunded: number;
    walletCount: number;
    frozenCount: number;
  };
  pendingTopUps: any[];
  payroll: {
    byStatus: Record<string, { count: number; totalNet: number; totalGross: number }>;
    totalPaidThisPeriod: number;
  };
  ledgerRecent: any[];
  revenue: {
    totalSessionRevenue: number;
    totalTeacherCost: number;
    grossProfit: number;
  };
}

export interface OpsDashboard {
  classes: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
  };
  sessions: {
    total: number;
    byStatus: Record<string, number>;
    upcomingToday: number;
    needsFinalization: number;
  };
  teachers: {
    total: number;
    active: number;
    pendingApproval: number;
    suspended: number;
  };
  students: {
    total: number;
    pendingApproval: number;
  };
  tickets: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdueCount: number;
    assignedToMe: number;
  };
  recentTickets: any[];
}

export interface TeacherDashboard {
  profile: any;
  sessions: {
    total: number;
    byStatus: Record<string, number>;
    upcomingCount: number;
    completedCount: number;
    cancelledCount: number;
    noShowCount: number;
  };
  earnings: {
    totalEarned: number;
    pendingPayout: number;
    lastPayroll: any;
  };
  classes: {
    activeCount: number;
    list: any[];
  };
  tickets: {
    myTickets: number;
    openTickets: number;
  };
  upcoming: any[];
}

export interface ParentDashboard {
  wallet: {
    balance: number;
    totalTopUp: number;
    totalDeducted: number;
    totalRefunded: number;
    status: string;
  } | null;
  children: {
    total: number;
    list: any[];
  };
  sessions: {
    total: number;
    byStatus: Record<string, number>;
    upcomingCount: number;
    needsConfirmation: number;
  };
  recentSessions: any[];
  recentTransactions: any[];
  invoices: {
    total: number;
    totalPaid: number;
    list: any[];
  };
  attendance: {
    total: number;
    byStatus: Record<string, number>;
    recentList: any[];
  };
  tickets: {
    myTickets: number;
    openTickets: number;
  };
}

export type DailyTaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | (string & {});

export interface DailyTaskItem {
  id: string;
  type: string;
  title: string;
  detail?: string;
  meta?: string[];
  count?: number;
  status?: string;
  priority: DailyTaskPriority;
  dueAt?: string;
  route: string;
  queryParams?: Record<string, string>;
  actionLabel?: string;
  overdue?: boolean;
}

export interface DailyTaskTab {
  key: string;
  label: string;
  description: string;
  emptyMessage: string;
  count: number;
  tasks: DailyTaskItem[];
}

export interface DailyTaskBoard {
  role: Role;
  title: string;
  subtitle: string;
  generatedAt: string;
  summary: {
    totalTasks: number;
    overdueTasks: number;
    dueTodayTasks: number;
    highPriorityTasks: number;
  };
  tabs: DailyTaskTab[];
}

export type DailyTaskBucket = 'priority' | 'today' | 'followup';
