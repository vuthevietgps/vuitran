import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DashboardService } from '../../services/dashboard.service';

interface QuickLink {
  title: string;
  description: string;
  route: string;
  cta: string;
}

interface DashboardWallet {
  balance: number;
  totalTopUp: number;
  totalDeducted: number;
  totalRefunded: number;
  status: string;
}

interface DashboardChild {
  _id?: string;
  fullName?: string;
  name?: string;
  grade?: string;
  subjects?: string[];
}

interface DashboardEntityRef {
  _id?: string;
  fullName?: string;
  name?: string;
  code?: string;
  studentCode?: string;
}

interface DashboardSessionItem {
  scheduledDate?: string;
  scheduledStartTime?: string;
  status?: string;
  teacherId?: DashboardEntityRef | null;
  studentId?: DashboardEntityRef | null;
  classId?: DashboardEntityRef | null;
}

interface DashboardInvoiceItem {
  invoiceNumber?: string;
  status?: string;
  amount?: number;
  paymentDate?: string;
  studentId?: DashboardEntityRef | null;
  classId?: DashboardEntityRef | null;
}

interface DashboardAttendanceItem {
  date?: string;
  status?: string;
  notes?: string;
  teacherId?: DashboardEntityRef | null;
  studentId?: DashboardEntityRef | null;
  classId?: DashboardEntityRef | null;
}

interface DashboardTransactionItem {
  type?: string;
  status?: string;
  amount?: number;
  description?: string;
  createdAt?: string;
}

interface ParentDashboardData {
  wallet: DashboardWallet | null;
  children: {
    total: number;
    list: DashboardChild[];
  };
  sessions: {
    total: number;
    byStatus: Record<string, number>;
    upcomingCount: number;
    needsConfirmation: number;
  };
  recentSessions: DashboardSessionItem[];
  recentTransactions: DashboardTransactionItem[];
  invoices: {
    total: number;
    totalPaid: number;
    list: DashboardInvoiceItem[];
  };
  attendance: {
    total: number;
    byStatus: Record<string, number>;
    recentList: DashboardAttendanceItem[];
  };
  tickets: {
    myTickets: number;
    openTickets: number;
  };
}

interface HighlightItem {
  name: string;
  code?: string;
}

const FINANCE_LINKS: QuickLink[] = [
  {
    title: 'H\u00f3a \u0111\u01a1n',
    description: 'Theo d\u00f5i l\u1ecbch s\u1eed h\u1ecdc ph\u00ed v\u00e0 t\u00ecnh tr\u1ea1ng thanh to\u00e1n theo t\u1eebng con.',
    route: '/app/parent-invoices',
    cta: 'M\u1edf h\u00f3a \u0111\u01a1n',
  },
  {
    title: 'V\u00ed & giao d\u1ecbch',
    description: 'Xem s\u1ed1 d\u01b0, n\u1ea1p v\u00ed v\u00e0 ki\u1ec3m tra ti\u1ec1n v\u00e0o, ti\u1ec1n ra g\u1ea7n \u0111\u00e2y.',
    route: '/app/wallets',
    cta: 'M\u1edf v\u00ed',
  },
];

const LEARNING_LINKS: QuickLink[] = [
  {
    title: 'Ch\u01b0\u01a1ng tr\u00ecnh h\u1ecdc',
    description: 'Xem khung ch\u01b0\u01a1ng tr\u00ecnh, t\u00e0i li\u1ec7u v\u00e0 n\u1ed9i dung h\u1ecdc c\u1ee7a t\u1eebng giai \u0111o\u1ea1n.',
    route: '/app/teaching-materials',
    cta: 'M\u1edf ch\u01b0\u01a1ng tr\u00ecnh',
  },
  {
    title: 'L\u1edbp h\u1ecdc',
    description: 'Theo d\u00f5i l\u1edbp, l\u1ecbch h\u1ecdc s\u1eafp t\u1edbi v\u00e0 t\u00ecnh tr\u1ea1ng x\u00e1c nh\u1eadn bu\u1ed5i h\u1ecdc.',
    route: '/app/sessions',
    cta: 'M\u1edf l\u1edbp h\u1ecdc',
  },
  {
    title: 'B\u00e1o c\u00e1o gi\u1ea3ng d\u1ea1y chi ti\u1ebft',
    description: 'Xem nh\u1eadn x\u00e9t, b\u00e0i t\u1eadp, ti\u1ebfn \u0111\u1ed9 v\u00e0 \u0111\u00e1nh gi\u00e1 c\u1ee7a gi\u00e1o vi\u00ean.',
    route: '/app/student-progress',
    cta: 'M\u1edf h\u1ecdc b\u1ea1',
  },
];

const SUPPORT_LINKS: QuickLink[] = [
  {
    title: 'Ticket h\u1ed7 tr\u1ee3',
    description: 'T\u1ea1o y\u00eau c\u1ea7u, theo d\u00f5i tr\u1ea1ng th\u00e1i x\u1eed l\u00fd v\u00e0 trao \u0111\u1ed5i tr\u1ef1c ti\u1ebfp.',
    route: '/app/tickets',
    cta: 'M\u1edf ticket',
  },
  {
    title: 'Chatbot',
    description: 'H\u1ecfi nhanh v\u1ec1 ti\u1ebfn \u0111\u1ed9, l\u1ecbch h\u1ecdc, b\u00e0i t\u1eadp; case nh\u1ea1y c\u1ea3m s\u1ebd chuy\u1ec3n th\u00e0nh ticket.',
    route: '/app/parent-chat',
    cta: 'M\u1edf chatbot',
  },
];

const SESSION_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: '\u0110\u00e3 l\u00ean l\u1ecbch',
  TEACHER_COMPLETED: 'Ch\u1edd x\u00e1c nh\u1eadn',
  PARENT_CONFIRMED: 'Ph\u1ee5 huynh x\u00e1c nh\u1eadn',
  FINALIZED: 'Ho\u00e0n t\u1ea5t',
  CANCELLED: '\u0110\u00e3 h\u1ee7y',
  NO_SHOW: 'V\u1eafng',
  RESCHEDULED: 'D\u1eddi l\u1ecbch',
};

const TRANSACTION_LABELS: Record<string, string> = {
  TOP_UP: 'N\u1ea1p ti\u1ec1n',
  SESSION_DEDUCT: 'Tr\u1eeb bu\u1ed5i h\u1ecdc',
  REFUND: 'Ho\u00e0n ti\u1ec1n',
  ADJUSTMENT: '\u0110i\u1ec1u ch\u1ec9nh',
  BONUS: 'Th\u01b0\u1edfng',
  TRANSFER_OUT: 'Chuy\u1ec3n \u0111i',
  TRANSFER_IN: 'Nh\u1eadn chuy\u1ec3n',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  APPROVED: '\u0110\u00e3 thanh to\u00e1n',
  PAID: '\u0110\u00e3 thanh to\u00e1n',
  PENDING: 'Ch\u1edd x\u1eed l\u00fd',
  PENDING_APPROVAL: 'Ch\u1edd duy\u1ec7t',
  CANCELLED: '\u0110\u00e3 h\u1ee7y',
  REJECTED: 'T\u1eeb ch\u1ed1i',
};

const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENT: 'C\u00f3 m\u1eb7t',
  ABSENT: 'V\u1eafng',
  LATE: '\u0110i mu\u1ed9n',
  EXCUSED: 'Xin ph\u00e9p',
};

@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './parent-dashboard.component.html',
  styleUrls: ['./parent-dashboard.component.css'],
})
export class ParentDashboardComponent implements OnInit {
  readonly financeLinks = FINANCE_LINKS;
  readonly learningLinks = LEARNING_LINKS;
  readonly supportLinks = SUPPORT_LINKS;

  data = signal<ParentDashboardData | null>(null);
  loading = signal(false);
  error = signal('');

  readonly children = computed(() => this.data()?.children?.list || []);
  readonly recentInvoices = computed(() => (this.data()?.invoices?.list || []).slice(0, 6));
  readonly recentTransactions = computed(() => (this.data()?.recentTransactions || []).slice(0, 8));
  readonly upcomingSessions = computed(() => (this.data()?.recentSessions || []).slice(0, 6));
  readonly recentReports = computed(() => (this.data()?.attendance?.recentList || []).slice(0, 6));
  readonly totalInflow = computed(() => {
    const wallet = this.data()?.wallet;
    if (!wallet) return 0;
    return Number(wallet.totalTopUp || 0) + Number(wallet.totalRefunded || 0);
  });
  readonly totalOutflow = computed(() => Number(this.data()?.wallet?.totalDeducted || 0));
  readonly programSubjects = computed(() => {
    const subjects = new Set<string>();
    for (const child of this.children()) {
      for (const subject of child.subjects || []) {
        if (subject) {
          subjects.add(subject);
        }
      }
    }
    return Array.from(subjects.values());
  });
  readonly classHighlights = computed<HighlightItem[]>(() => {
    const result = new Map<string, HighlightItem>();
    for (const session of this.data()?.recentSessions || []) {
      this.pushHighlight(result, session.classId);
    }
    for (const invoice of this.data()?.invoices?.list || []) {
      this.pushHighlight(result, invoice.classId);
    }
    for (const attendance of this.data()?.attendance?.recentList || []) {
      this.pushHighlight(result, attendance.classId);
    }
    return Array.from(result.values()).slice(0, 10);
  });
  readonly teacherHighlights = computed<string[]>(() => {
    const result = new Set<string>();
    for (const session of this.data()?.recentSessions || []) {
      const teacher = this.personLabel(session.teacherId);
      if (teacher !== '-') {
        result.add(teacher);
      }
    }
    for (const attendance of this.data()?.attendance?.recentList || []) {
      const teacher = this.personLabel(attendance.teacherId);
      if (teacher !== '-') {
        result.add(teacher);
      }
    }
    return Array.from(result.values()).slice(0, 10);
  });

  constructor(private readonly dashboardService: DashboardService) {}

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.dashboardService.getParentDashboard();
      this.data.set(result);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'Khong the tai dashboard phu huynh.');
    } finally {
      this.loading.set(false);
    }
  }

  childLabel(child?: DashboardChild | null): string {
    return child?.fullName || child?.name || 'Hoc sinh';
  }

  personLabel(person?: DashboardEntityRef | null): string {
    return person?.fullName || person?.name || '-';
  }

  studentLabel(student?: DashboardEntityRef | null): string {
    const name = student?.fullName || student?.name;
    if (!name) {
      return '-';
    }
    return student?.studentCode ? `${name} (${student.studentCode})` : name;
  }

  classLabel(classRef?: DashboardEntityRef | null): string {
    if (!classRef?.name) {
      return '-';
    }
    return classRef.code ? `${classRef.code} - ${classRef.name}` : classRef.name;
  }

  statusLabel(status?: string): string {
    if (!status) return '-';
    return SESSION_STATUS_LABELS[status] || status;
  }

  txLabel(type?: string): string {
    if (!type) return '-';
    return TRANSACTION_LABELS[type] || type;
  }

  invoiceStatusLabel(status?: string): string {
    if (!status) return '-';
    return INVOICE_STATUS_LABELS[status] || status;
  }

  attendanceLabel(status?: string): string {
    if (!status) return '-';
    return ATTENDANCE_LABELS[status] || status;
  }

  isCredit(type?: string): boolean {
    return ['TOP_UP', 'REFUND', 'TRANSFER_IN', 'BONUS'].includes(type || '');
  }

  private pushHighlight(collection: Map<string, HighlightItem>, item?: DashboardEntityRef | null): void {
    const name = item?.name;
    if (!name) {
      return;
    }
    const key = item?._id || `${item.code || ''}:${name}`;
    if (!collection.has(key)) {
      collection.set(key, { name, code: item.code });
    }
  }
}
