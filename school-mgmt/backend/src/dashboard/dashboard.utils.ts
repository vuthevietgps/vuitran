import { Role } from '../common/interfaces/role.enum';
import { TicketStatus, TicketPriority } from '../tickets/schemas/ticket.schema';
import { LeadStatus } from '../leads/schemas/lead.schema';
import { ActionableSuggestion } from '../ads/ads.types';
import { DailyTaskBoard, DailyTaskItem, DailyTaskPriority, DailyTaskTab } from './dashboard.types';

// ─── Date helpers ───────────────────────────────────────────────────

export function startOfDay(date: Date): Date {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

export function addDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

export function isSameDay(value: string | Date, reference: Date): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const start = startOfDay(reference);
  const end = addDays(start, 1);
  return date >= start && date < end;
}

export function isOverdue(value: string | Date | undefined | null, reference: Date): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < reference.getTime();
}

export function toIso(value: string | Date | undefined | null): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function toShortDate(value: string | Date | undefined | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

// ─── Formatting helpers ─────────────────────────────────────────────

export function formatCurrency(value: number | undefined | null): string {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('vi-VN')}d`;
}

export function compactMeta(values: Array<string | undefined | null>): string[] {
  return values.filter((value): value is string => Boolean(value && value.trim()));
}

export function personName(person?: { fullName?: string; name?: string } | null): string {
  return person?.fullName || person?.name || '';
}

export function studentName(student?: { fullName?: string; name?: string; studentCode?: string } | null): string {
  const name = student?.fullName || student?.name || '';
  if (!name) return '';
  return student?.studentCode ? `${name} (${student.studentCode})` : name;
}

export function className(classRef?: { name?: string; code?: string } | null): string {
  if (!classRef?.name) return '';
  return classRef.code ? `${classRef.code} - ${classRef.name}` : classRef.name;
}

// ─── Date filter builder ────────────────────────────────────────────

export function buildDateFilter(fromDate?: string, toDate?: string): any {
  if (!fromDate && !toDate) return {};
  const filter: any = {};
  if (fromDate) filter.$gte = new Date(fromDate);
  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    filter.$lte = end;
  }
  return { createdAt: filter };
}

// ─── Daily task helpers ─────────────────────────────────────────────

export function buildDailyTaskBoard(role: Role, tabs: DailyTaskTab[]): DailyTaskBoard {
  const normalizedTabs = tabs.map((tab) => ({
    ...tab,
    tasks: sortDailyTasks(tab.tasks),
    count: tab.tasks.length,
  }));
  const allTasks = normalizedTabs.flatMap((tab) => tab.tasks);
  const today = startOfDay(new Date());

  return {
    role,
    title: 'Viec trong ngay',
    subtitle: 'Danh sach can xu ly tu cac module theo role hien tai.',
    generatedAt: new Date().toISOString(),
    summary: {
      totalTasks: allTasks.length,
      overdueTasks: allTasks.filter((t) => t.overdue).length,
      dueTodayTasks: allTasks.filter((t) => t.dueAt && isSameDay(t.dueAt, today)).length,
      highPriorityTasks: allTasks.filter(
        (t) => t.priority === 'CRITICAL' || t.priority === 'HIGH',
      ).length,
    },
    tabs: normalizedTabs,
  };
}

export function sortDailyTasks(tasks: DailyTaskItem[]): DailyTaskItem[] {
  return [...tasks].sort((a, b) => {
    const overdueDiff = (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0);
    if (overdueDiff !== 0) return overdueDiff;

    const priorityDiff = getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
    if (priorityDiff !== 0) return priorityDiff;

    const aDate = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const bDate = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return aDate - bDate;
  });
}

export function getPriorityWeight(priority: DailyTaskPriority): number {
  switch (priority) {
    case 'CRITICAL': return 4;
    case 'HIGH': return 3;
    case 'MEDIUM': return 2;
    case 'LOW': return 1;
    default: return 0;
  }
}

export function getOpenTicketStatuses(): TicketStatus[] {
  return [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_INFO];
}

export function getActiveLeadStatuses(): LeadStatus[] {
  return [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.CONSULTING, LeadStatus.INTERESTED];
}

export function mapTicketPriority(priority?: TicketPriority): DailyTaskPriority {
  switch (priority) {
    case TicketPriority.URGENT: return 'CRITICAL';
    case TicketPriority.HIGH: return 'HIGH';
    case TicketPriority.MEDIUM: return 'MEDIUM';
    case TicketPriority.LOW: return 'LOW';
    default: return 'MEDIUM';
  }
}

export function mapAdsActionToTask(action: ActionableSuggestion): DailyTaskItem {
  const route = action.type === 'ADJUST_BUDGET' || action.type === 'PAUSE_GROUP'
    ? '/app/ads-management'
    : '/app/ads-analytics';
  return {
    id: `ads-action-${action.type}-${action.relatedEntity?.id || action.title}`,
    type: action.type,
    title: action.title,
    detail: action.description,
    meta: compactMeta([
      action.relatedEntity?.name,
      action.estimatedImpact?.monthlyProfitChange != null
        ? `${formatCurrency(action.estimatedImpact.monthlyProfitChange)}/thang`
        : undefined,
    ]),
    priority: action.priority,
    dueAt: undefined,
    route,
    actionLabel: route === '/app/ads-management' ? 'Mo ads management' : 'Mo ads analytics',
    overdue: action.priority === 'CRITICAL',
  };
}
