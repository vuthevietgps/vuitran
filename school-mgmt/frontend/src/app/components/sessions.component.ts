import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SessionGeneralFeedbackPayload,
  SessionChangeRequestItem,
  SessionEditHistoryEntry,
  SessionItem,
  SessionParentConfirmPayload,
  SessionQueryParams,
  SessionReference,
  SessionService,
} from '../services/session.service';
import { ClassItem, ClassService } from '../services/class.service';
import { AuthService } from '../services/auth.service';
import { TeacherProfile, TeacherService } from '../services/teacher.service';
import { FlowGuideComponent } from './shared/flow-guide.component';

type CompleteField = 'topicsCovered' | 'homework' | 'teacherNotes';

interface GeneralFeedbackTarget {
  studentId: string;
  studentName: string;
  sessionId: string;
  classLabel: string;
  scheduledDate: string;
}

interface GeneralFeedbackFormState extends SessionGeneralFeedbackPayload {
  studentId: string;
  sessionId: string;
}

interface SessionChangeRequestFormState {
  requestedScheduledDate: string;
  requestedStartTime: string;
  requestedTeacherId: string;
  reason: string;
}

interface SessionRescheduleFormState {
  newScheduledDate: string;
  newStartTime: string;
  newEndTime: string;
  reason: string;
}

interface TeacherOption {
  userId: string;
  fullName: string;
}

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  templateUrl: './sessions.component.html',
  styleUrl: './sessions.component.css',
})
export class SessionsComponent implements OnInit {
  private sessionSvc = inject(SessionService);
  private classSvc = inject(ClassService);
  private teacherSvc = inject(TeacherService);
  private auth: AuthService;

  sessions = signal<SessionItem[]>([]);
  classes = signal<ClassItem[]>([]);
  stats = signal<{
    totalSessions: number;
    totalRevenue: number;
    totalTeacherCost: number;
    byStatus: any;
  } | null>(null);
  showCreateModal = signal(false);
  showDetailModal = signal(false);
  showCompleteModal = signal(false);
  showConfirmModal = signal(false);
  showGeneralFeedbackModal = signal(false);
  showChangeRequestForm = signal(false);
  showRescheduleForm = signal(false);
  detailLoading = signal(false);
  changeRequestsLoading = signal(false);
  submittingComplete = signal(false);
  submittingGeneralFeedback = signal(false);
  submittingChangeRequest = signal(false);
  submittingReschedule = signal(false);
  success = signal('');
  error = signal('');
  selectedSession = signal<SessionItem | null>(null);
  latestRescheduledSession = signal<SessionItem | null>(null);
  selectedClassStudents = signal<any[]>([]);
  changeRequests = signal<SessionChangeRequestItem[]>([]);
  teacherOptions = signal<TeacherOption[]>([]);
  currentPage = signal(1);
  totalPages = signal(1);

  createMode: 'single' | 'bulk' = 'single';

  filter: SessionQueryParams = { classId: '', status: '', fromDate: '', toDate: '' };

  createForm: any = {
    classId: '',
    studentId: '',
    scheduledDate: '',
    scheduledStartTime: '',
    scheduledEndTime: '',
  };
  completeForm: any = { topicsCovered: '', homework: '', teacherNotes: '' };
  completeTouched: Record<CompleteField, boolean> = {
    topicsCovered: false,
    homework: false,
    teacherNotes: false,
  };
  completeSubmitAttempted = false;
  confirmForm: SessionParentConfirmPayload = { rating: 5, parentNotes: '' };
  generalFeedbackForm: GeneralFeedbackFormState = this.createGeneralFeedbackForm();
  changeRequestForm: SessionChangeRequestFormState = this.createChangeRequestForm();
  rescheduleForm: SessionRescheduleFormState = this.createRescheduleForm();
  actionSessionId = '';

  constructor(auth: AuthService) {
    this.auth = auth;
  }

  ngOnInit(): void {
    this.load();
    this.loadClasses();
  }

  async load(): Promise<void> {
    const params: SessionQueryParams = { page: this.currentPage(), limit: 20 };
    if (this.filter.classId) params.classId = this.filter.classId;
    if (this.filter.status) params.status = this.filter.status;
    if (this.filter.fromDate) params.fromDate = this.filter.fromDate;
    if (this.filter.toDate) params.toDate = this.filter.toDate;

    const res = await this.sessionSvc.list(params);
    this.sessions.set(res.data || []);
    this.totalPages.set(res.meta?.totalPages || 1);

    if (this.canCreate()) {
      const statsParams: any = {};
      if (this.filter.classId) statsParams.classId = this.filter.classId;
      if (this.filter.fromDate) statsParams.fromDate = this.filter.fromDate;
      if (this.filter.toDate) statsParams.toDate = this.filter.toDate;
      const st = await this.sessionSvc.getStats(statsParams);
      this.stats.set(st);
    }
  }

  async loadClasses(): Promise<void> {
    const res = await this.classSvc.list();
    this.classes.set(res);
  }

  goPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.load();
  }

  openCreate(): void {
    this.createForm = {
      classId: '',
      studentId: '',
      scheduledDate: '',
      scheduledStartTime: '',
      scheduledEndTime: '',
    };
    this.createMode = 'single';
    this.selectedClassStudents.set([]);
    this.showCreateModal.set(true);
  }

  onCreateClassChange(): void {
    const cls = this.classes().find((item) => item._id === this.createForm.classId);
    if (cls?.students) {
      this.selectedClassStudents.set(cls.students);
    } else {
      this.selectedClassStudents.set([]);
    }
    this.createForm.studentId = '';
  }

  async submitCreate(): Promise<void> {
    if (this.createMode === 'bulk') {
      const ok = await this.sessionSvc.bulkCreate({
        classId: this.createForm.classId,
        scheduledDate: this.createForm.scheduledDate,
        scheduledStartTime: this.createForm.scheduledStartTime,
        scheduledEndTime: this.createForm.scheduledEndTime,
      });
      if (ok) {
        this.showCreateModal.set(false);
        this.load();
      } else {
        alert('\u004c\u1ed7i khi t\u1ea1o h\u00e0ng lo\u1ea1t');
      }
      return;
    }

    const ok = await this.sessionSvc.create({
      classId: this.createForm.classId,
      studentId: this.createForm.studentId,
      scheduledDate: this.createForm.scheduledDate,
      scheduledStartTime: this.createForm.scheduledStartTime,
      scheduledEndTime: this.createForm.scheduledEndTime,
    });
    if (ok) {
      this.showCreateModal.set(false);
      this.load();
    } else {
      alert('\u004c\u1ed7i khi t\u1ea1o bu\u1ed5i h\u1ecdc');
    }
  }

  async viewDetail(session: SessionItem): Promise<void> {
    this.error.set('');
    this.success.set('');
    this.selectedSession.set(session);
    this.showChangeRequestForm.set(false);
    this.showRescheduleForm.set(false);
    this.latestRescheduledSession.set(null);
    this.changeRequests.set([]);
    this.teacherOptions.set([]);
    this.changeRequestForm = this.createChangeRequestForm(session);
    this.rescheduleForm = this.createRescheduleForm(session);
    this.showDetailModal.set(true);
    this.detailLoading.set(true);
    this.changeRequestsLoading.set(true);

    try {
      const [detail, changeRequests] = await Promise.all([
        this.sessionSvc.getById(session._id),
        this.sessionSvc.getChangeRequests(session._id),
      ]);
      if (detail) {
        this.selectedSession.set({ ...session, ...detail });
        this.changeRequestForm = this.createChangeRequestForm({ ...session, ...detail });
        this.rescheduleForm = this.createRescheduleForm({ ...session, ...detail });
        if (this.canRequestSessionChange({ ...session, ...detail })) {
          await this.loadTeacherOptions({ ...session, ...detail });
        }
      }
      this.changeRequests.set(this.sortChangeRequests(changeRequests));
    } finally {
      this.detailLoading.set(false);
      this.changeRequestsLoading.set(false);
    }
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedSession.set(null);
    this.showChangeRequestForm.set(false);
    this.showRescheduleForm.set(false);
    this.changeRequestsLoading.set(false);
    this.submittingChangeRequest.set(false);
    this.submittingReschedule.set(false);
    this.latestRescheduledSession.set(null);
    this.changeRequests.set([]);
    this.teacherOptions.set([]);
    this.changeRequestForm = this.createChangeRequestForm();
    this.rescheduleForm = this.createRescheduleForm();
  }

  async openChangeRequestForm(): Promise<void> {
    const session = this.selectedSession();
    if (!session || !this.canRequestSessionChange(session)) {
      return;
    }

    this.error.set('');
    this.success.set('');
    this.changeRequestForm = this.createChangeRequestForm(session);
    this.showChangeRequestForm.set(true);
    if (!this.teacherOptions().length) {
      await this.loadTeacherOptions(session);
    }
  }

  cancelChangeRequestForm(): void {
    this.showChangeRequestForm.set(false);
    this.changeRequestForm = this.createChangeRequestForm(this.selectedSession());
  }

  openRescheduleForm(): void {
    const session = this.selectedSession();
    if (!session || !this.canRescheduleSession(session)) {
      return;
    }

    this.error.set('');
    this.success.set('');
    this.rescheduleForm = this.createRescheduleForm(session);
    this.showRescheduleForm.set(true);
  }

  cancelRescheduleForm(): void {
    this.showRescheduleForm.set(false);
    this.rescheduleForm = this.createRescheduleForm(this.selectedSession());
  }

  async submitReschedule(): Promise<void> {
    const session = this.selectedSession();
    if (!session || !this.canRescheduleSession(session)) {
      return;
    }

    const form = this.normalizeRescheduleForm();
    if (!form.newScheduledDate || !form.newStartTime || !form.newEndTime) {
      this.error.set('Vui long nhap du ngay gio moi.');
      return;
    }

    const nextDurationMinutes = this.calculateDurationMinutes(form.newStartTime, form.newEndTime);
    if (!nextDurationMinutes) {
      this.error.set('Khung gio moi khong hop le.');
      return;
    }

    const currentDate = this.formatDateInput(session.scheduledDate);
    const currentStartTime = `${session.scheduledStartTime || ''}`.trim();
    const currentEndTime = `${session.scheduledEndTime || ''}`.trim();
    const dateChanged = form.newScheduledDate !== currentDate;
    const startChanged = form.newStartTime !== currentStartTime;
    const endChanged = form.newEndTime !== currentEndTime;

    if (!dateChanged && !startChanged && !endChanged) {
      this.error.set('Lich moi phai khac buoi hoc hien tai.');
      return;
    }

    this.submittingReschedule.set(true);
    this.error.set('');
    this.success.set('');

    try {
      const result = await this.sessionSvc.reschedule(session._id, {
        newScheduledDate: form.newScheduledDate,
        newStartTime: form.newStartTime,
        newEndTime: form.newEndTime,
        durationMinutes: nextDurationMinutes,
        reason: form.reason || undefined,
      });

      if (!result.ok || !result.data?.oldSession || !result.data?.newSession) {
        this.error.set(result.errorMessage || 'Khong the doi lich buoi hoc.');
        return;
      }

      const nextSession = this.mergeSessionSnapshot(session, result.data.newSession);
      const currentSession = this.mergeSessionSnapshot(session, result.data.oldSession, {
        status: result.data.oldSession.status || 'RESCHEDULED',
        rescheduledToId: this.toSessionReference(nextSession),
      });

      this.latestRescheduledSession.set(nextSession);
      this.selectedSession.set(currentSession);
      this.showRescheduleForm.set(false);
      this.rescheduleForm = this.createRescheduleForm(nextSession);
      this.success.set('Da doi lich buoi hoc thanh cong.');
      await this.load();
    } finally {
      this.submittingReschedule.set(false);
    }
  }

  async submitChangeRequest(): Promise<void> {
    const session = this.selectedSession();
    if (!session || !this.canRequestSessionChange(session)) {
      return;
    }

    const form = this.normalizeChangeRequestForm();
    const currentTeacherId = this.teacherUserId(session);
    const currentDurationMinutes = this.sessionDurationMinutes(session);
    const currentDate = this.formatDateInput(session.scheduledDate);
    const currentStartTime = `${session.scheduledStartTime || ''}`.trim();
    const requestedEndTime = form.requestedStartTime
      ? this.addMinutesToTime(form.requestedStartTime, currentDurationMinutes)
      : null;

    if (!form.reason) {
      this.error.set('Vui long nhap ly do thay doi.');
      return;
    }

    const teacherChanged = !!form.requestedTeacherId && form.requestedTeacherId !== currentTeacherId;
    const dateChanged = !!form.requestedScheduledDate && form.requestedScheduledDate !== currentDate;
    const timeChanged = !!form.requestedStartTime && form.requestedStartTime !== currentStartTime;

    if (!teacherChanged && !dateChanged && !timeChanged) {
      this.error.set('Yeu cau thay doi phai khac thong tin hien tai.');
      return;
    }

    if (timeChanged && (!currentDurationMinutes || !requestedEndTime)) {
      this.error.set('Gio hoc moi khong hop le voi thoi luong hien tai.');
      return;
    }

    this.submittingChangeRequest.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await this.sessionSvc.createChangeRequest(session._id, {
        requestedScheduledDate: dateChanged ? form.requestedScheduledDate : undefined,
        requestedStartTime: timeChanged ? form.requestedStartTime : undefined,
        requestedEndTime: timeChanged ? requestedEndTime || undefined : undefined,
        requestedTeacherId: teacherChanged ? form.requestedTeacherId : undefined,
        reason: form.reason,
      });

      this.changeRequestsLoading.set(true);
      const latestRequests = await this.sessionSvc.getChangeRequests(session._id);
      this.changeRequests.set(this.sortChangeRequests(latestRequests));
      this.showChangeRequestForm.set(false);
      this.changeRequestForm = this.createChangeRequestForm(session);
      this.success.set('Đã gửi yêu cầu thay đổi buổi học.');
    } catch (error: any) {
      this.error.set(this.extractUiErrorMessage(error, 'Không thể gửi yêu cầu thay đổi buổi học.'));
    } finally {
      this.submittingChangeRequest.set(false);
      this.changeRequestsLoading.set(false);
    }
  }

  completeSession(session: SessionItem): void {
    this.actionSessionId = session._id;
    this.resetCompleteForm();
    this.showCompleteModal.set(true);
  }

  async submitComplete(): Promise<void> {
    this.completeSubmitAttempted = true;
    const payload = this.normalizeCompleteForm();
    this.completeForm = { ...payload };
    if (!this.isCompleteFormValid(payload)) {
      return;
    }

    this.submittingComplete.set(true);
    try {
      const ok = await this.sessionSvc.teacherComplete(this.actionSessionId, payload);
      if (ok) {
        this.closeCompleteModal();
        await this.load();
      } else {
        alert('\u004c\u1ed7i khi ho\u00e0n th\u00e0nh bu\u1ed5i h\u1ecdc');
      }
    } finally {
      this.submittingComplete.set(false);
    }
  }

  closeCompleteModal(): void {
    this.showCompleteModal.set(false);
    this.resetCompleteForm();
  }

  markCompleteFieldTouched(field: CompleteField): void {
    this.completeTouched[field] = true;
  }

  completeError(field: CompleteField): string {
    if (!(this.completeSubmitAttempted || this.completeTouched[field])) {
      return '';
    }
    const value = `${this.completeForm[field] || ''}`.trim();
    if (value) return '';

    const messages: Record<CompleteField, string> = {
      topicsCovered: 'Vui long nhap noi dung da day.',
      homework: 'Vui long nhap bai tap ve nha.',
      teacherNotes: 'Vui long nhap ghi chu giao vien.',
    };
    return messages[field];
  }

  canSubmitComplete(): boolean {
    return !this.submittingComplete() && this.isCompleteFormValid(this.normalizeCompleteForm());
  }

  confirmSession(session: SessionItem): void {
    if (!this.canParentConfirmSession(session)) {
      alert('Bu\u1ed5i h\u1ecdc ch\u01b0a c\u00f3 b\u00e1o c\u00e1o gi\u1ea3ng d\u1ea1y, ch\u01b0a th\u1ec3 x\u00e1c nh\u1eadn.');
      return;
    }
    this.success.set('');
    this.actionSessionId = session._id;
    this.confirmForm = { rating: 5, parentNotes: '' };
    this.showConfirmModal.set(true);
  }

  async submitConfirm(): Promise<void> {
    const ok = await this.sessionSvc.parentConfirm(this.actionSessionId, this.confirmForm);
    if (ok) {
      this.showConfirmModal.set(false);
      this.success.set('Da ghi nhan danh gia buoi hoc thanh cong.');
      this.load();
    } else {
      alert('\u004c\u1ed7i khi x\u00e1c nh\u1eadn bu\u1ed5i h\u1ecdc');
    }
  }

  openGeneralFeedback(): void {
    const targets = this.generalFeedbackTargets();
    if (!targets.length) {
      this.error.set('Chưa có buổi đã chốt để gửi đánh giá tổng quát.');
      return;
    }

    this.success.set('');
    this.error.set('');
    this.generalFeedbackForm = this.createGeneralFeedbackForm(targets[0]);
    this.showGeneralFeedbackModal.set(true);
  }

  closeGeneralFeedbackModal(): void {
    this.showGeneralFeedbackModal.set(false);
    this.generalFeedbackForm = this.createGeneralFeedbackForm();
  }

  generalFeedbackTargets(): GeneralFeedbackTarget[] {
    if (!this.isParent()) {
      return [];
    }

    const latestByStudent = new Map<string, GeneralFeedbackTarget>();
    const finalizedSessions = [...this.sessions()]
      .filter((session) => session.status === 'FINALIZED' && !!session.studentId?._id)
      .sort((left, right) => {
        const leftTime = new Date(left.scheduledDate || '').getTime();
        const rightTime = new Date(right.scheduledDate || '').getTime();
        return rightTime - leftTime;
      });

    for (const session of finalizedSessions) {
      const studentId = session.studentId._id;
      if (!studentId || latestByStudent.has(studentId)) {
        continue;
      }

      latestByStudent.set(studentId, {
        studentId,
        studentName: session.studentId.fullName || 'Học sinh',
        sessionId: session._id,
        classLabel: session.classId.code || session.classId.name || 'Lớp học',
        scheduledDate: session.scheduledDate,
      });
    }

    return Array.from(latestByStudent.values());
  }

  onGeneralFeedbackStudentChange(studentId: string): void {
    this.generalFeedbackForm.studentId = studentId;
    const target = this.generalFeedbackTargets().find((item) => item.studentId === studentId);
    this.generalFeedbackForm.sessionId = target?.sessionId || '';
  }

  selectedGeneralFeedbackTarget(): GeneralFeedbackTarget | null {
    const studentId = this.generalFeedbackForm.studentId;
    if (!studentId) {
      return null;
    }
    return this.generalFeedbackTargets().find((item) => item.studentId === studentId) || null;
  }

  selectedGeneralFeedbackTargetLabel(): string {
    const target = this.selectedGeneralFeedbackTarget();
    if (!target) {
      return '';
    }
    return `${target.classLabel} • ${this.formatShortDate(target.scheduledDate)}`;
  }

  canSubmitGeneralFeedback(): boolean {
    const form = this.normalizeGeneralFeedbackForm();
    return !this.submittingGeneralFeedback() && this.isGeneralFeedbackFormValid(form);
  }

  async submitGeneralFeedback(): Promise<void> {
    const form = this.normalizeGeneralFeedbackForm();
    if (!this.isGeneralFeedbackFormValid(form)) {
      this.error.set('Vui lòng nhập đủ các trường đánh giá tổng quát từ 1 đến 5.');
      return;
    }

    this.submittingGeneralFeedback.set(true);
    this.error.set('');
    try {
      const result = await this.sessionSvc.submitGeneralFeedback(form);
      if (result.ok) {
        this.closeGeneralFeedbackModal();
        this.success.set(result.data?.message || 'Đã gửi đánh giá tổng quát.');
        await this.load();
      } else {
        this.error.set(result.errorMessage || 'Lỗi khi gửi đánh giá tổng quát');
      }
    } finally {
      this.submittingGeneralFeedback.set(false);
    }
  }

  private mergeSessionDetail(
    detail: SessionItem,
    fallback?: SessionItem | null,
  ): SessionItem {
    return {
      ...(fallback || {} as SessionItem),
      ...detail,
    };
  }

  private async handleFinalizePostState(
    sessionId: string,
    fallbackSession?: SessionItem | null,
  ): Promise<void> {
    await this.load();

    const detail = await this.sessionSvc.getById(sessionId);
    if (!detail) {
      if (this.selectedSession()?._id === sessionId) {
        this.showDetailModal.set(false);
        this.selectedSession.set(null);
      }
      return;
    }

    const merged = this.mergeSessionDetail(detail, fallbackSession || this.selectedSession());
    this.selectedSession.set(merged);

    const walletWarning = `${merged.walletDeductError || ''}`.trim();
    if (walletWarning) {
      this.showDetailModal.set(true);
      this.error.set(walletWarning);
      return;
    }

    if (this.selectedSession()?._id === sessionId || fallbackSession?._id === sessionId) {
      this.showDetailModal.set(false);
      this.selectedSession.set(null);
    }
  }

  async finalizeSession(session: SessionItem): Promise<void> {
    const message = session.status === 'FINALIZED'
      ? 'X\u00e1c nh\u1eadn payroll cho bu\u1ed5i h\u1ecdc n\u00e0y? H\u1ec7 th\u1ed1ng s\u1ebd \u0111\u00e1nh d\u1ea5u OPS/Gi\u00e1m \u0111\u1ed1c \u0111\u00e3 ch\u1ed1t \u0111\u1ec3 bu\u1ed5i h\u1ecdc \u0111\u1ee7 \u0111i\u1ec1u ki\u1ec7n t\u00ednh l\u01b0\u01a1ng.'
      : 'Ch\u1ed1t bu\u1ed5i h\u1ecdc n\u00e0y? S\u1ebd tr\u1eeb v\u00ed h\u1ecdc sinh v\u00e0 ghi nh\u1eadn l\u01b0\u01a1ng GV.';
    if (!confirm(message)) return;
    this.success.set('');
    this.error.set('');
    const result = await this.sessionSvc.finalize(session._id);
    if (result.ok) {
      await this.handleFinalizePostState(session._id, session);
    } else {
      const errorMessage = result.errorMessage || '\u004c\u1ed7i khi ch\u1ed1t bu\u1ed5i h\u1ecdc';
      this.error.set(errorMessage);
      alert(errorMessage);
    }
  }

  async confirmSalaryFromDetail(): Promise<void> {
    return this.confirmSalaryFromDetailClean();
  }

  async confirmSalaryFromDetailClean(): Promise<void> {
    const session = this.selectedSession();
    if (!session) return;

    const message = session.status === 'FINALIZED'
      ? 'X\u00e1c nh\u1eadn l\u01b0\u01a1ng cho bu\u1ed5i h\u1ecdc n\u00e0y? H\u1ec7 th\u1ed1ng s\u1ebd \u0111\u00e1nh d\u1ea5u bu\u1ed5i h\u1ecdc \u0111\u00e3 \u0111\u01b0\u1ee3c OPS/K\u1ebf to\u00e1n/Gi\u00e1m \u0111\u1ed1c duy\u1ec7t \u0111\u1ec3 v\u00e0o \u0111i\u1ec1u ki\u1ec7n t\u00ednh l\u01b0\u01a1ng.'
      : 'X\u00e1c nh\u1eadn l\u01b0\u01a1ng cho bu\u1ed5i h\u1ecdc n\u00e0y? H\u1ec7 th\u1ed1ng s\u1ebd ho\u00e0n t\u1ea5t bu\u1ed5i h\u1ecdc v\u00e0 ghi nh\u1eadn l\u01b0\u01a1ng gi\u00e1o vi\u00ean.';
    if (!confirm(message)) return;

    this.success.set('');
    this.error.set('');
    const result = await this.sessionSvc.finalize(session._id);
    if (result.ok) {
      await this.handleFinalizePostState(session._id, session);
    } else {
      const errorMessage = result.errorMessage || 'L\u1ed7i khi x\u00e1c nh\u1eadn l\u01b0\u01a1ng bu\u1ed5i h\u1ecdc';
      this.error.set(errorMessage);
      alert(errorMessage);
    }
  }

  async cancelSession(session: SessionItem): Promise<void> {
    const reason = prompt('\u004c\u00fd do h\u1ee7y bu\u1ed5i h\u1ecdc:');
    if (!reason) return;
    const ok = await this.sessionSvc.cancel(session._id, reason);
    if (ok) {
      this.load();
    } else {
      alert('\u004c\u1ed7i khi h\u1ee7y bu\u1ed5i h\u1ecdc');
    }
  }

  async remove(session: SessionItem): Promise<void> {
    if (!confirm('\u0058\u00f3a bu\u1ed5i h\u1ecdc n\u00e0y?')) return;
    const ok = await this.sessionSvc.remove(session._id);
    if (ok) {
      this.load();
    }
  }

  private roundMoneyToThousand(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized === 0) return 0;
    return Math.round(normalized / 1000) * 1000;
  }

  private roundMoneyDownToThousand(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized === 0) return 0;
    return normalized > 0
      ? Math.floor(normalized / 1000) * 1000
      : Math.ceil(normalized / 1000) * 1000;
  }

  formatCurrency(value: number): string {
    return this.roundMoneyToThousand(value).toLocaleString('vi-VN') + ' \u20ab';
  }

  formatTeacherCurrency(value: number): string {
    return this.roundMoneyDownToThousand(value).toLocaleString('vi-VN') + ' \u20ab';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      SCHEDULED: '\u0110\u00e3 l\u00ean l\u1ecbch',
      TEACHER_COMPLETED: 'GV ho\u00e0n th\u00e0nh',
      PARENT_CONFIRMED: 'PH x\u00e1c nh\u1eadn',
      FINALIZED: '\u0110\u00e3 ch\u1ed1t',
      CANCELLED: '\u0110\u00e3 h\u1ee7y',
      RESCHEDULED: '\u0110\u00e3 d\u1eddi l\u1ecbch',
      NO_SHOW: 'V\u1eafng',
    };
    return map[status] || status;
  }

  sessionStatusLabel(session: SessionItem | null | undefined): string {
    if (!session) return '';

    const trialDecisionLabel = this.trialDecisionStatusLabel(session);
    if (trialDecisionLabel) {
      return trialDecisionLabel;
    }

    if (session.status !== 'FINALIZED') {
      return this.statusLabel(session.status);
    }

    if (!session.isPaid && !!session.walletDeductError?.trim()) {
      return '\u0110\u00e3 ch\u1ed1t, ch\u1edd n\u1ea1p v\u00ed';
    }

    const hasReport = !!session.hasTeachingReport && !!session.teachingReport?.lessonContent?.trim();
    if (!hasReport) {
      return '\u0110\u00e3 ho\u00e0n t\u1ea5t, ch\u1edd b\u00e1o c\u00e1o';
    }

    if (!this.hasManualPayrollConfirmation(session)) {
      return '\u0110\u00e3 ho\u00e0n t\u1ea5t, ch\u1edd x\u00e1c nh\u1eadn l\u01b0\u01a1ng';
    }

    return '\u0110\u00e3 x\u00e1c nh\u1eadn l\u01b0\u01a1ng';
  }

  private trialDecisionStatusLabel(session: SessionItem | null | undefined): string {
    if (!session || session.sessionType !== 'TRIAL') {
      return '';
    }

    if (session.trialConverted) {
      return '\u0110\u00e3 \u0111\u01b0\u1ee3c duy\u1ec7t h\u1ecdc th\u1eed';
    }

    if (session.trialTeacherPaidOnly) {
      return '\u0110\u00e3 ch\u1ed1t h\u1ecdc th\u1eed, tr\u1ea3 l\u01b0\u01a1ng GV';
    }

    if (session.trialRejectedNoPay) {
      return 'H\u1ecdc th\u1eed kh\u00f4ng ti\u1ebfp t\u1ee5c';
    }

    return '';
  }

  shouldShowLowRatingFlag(session: SessionItem | null | undefined): boolean {
    if (!session?.parentRating || session.parentRating > 2) {
      return false;
    }
    const role = this.auth.userSignal()?.role;
    return role === 'OPS' || role === 'DIRECTOR';
  }

  lowRatingFlagLabel(session: SessionItem | null | undefined): string {
    const rating = Math.max(1, Math.min(Number(session?.parentRating || 0), 5));
    return '★'.repeat(rating);
  }

  confirmationSourceLabel(session: SessionItem | null | undefined): string {
    if (!session?.confirmation) return '';
    if (session.confirmation.autoConfirmedAt) {
      return 'Xác nhận tự động bởi Hệ thống';
    }
    if (session.confirmation.parentConfirmedAt) {
      return 'Xác nhận bởi Phụ huynh';
    }
    return '';
  }

  confirmationTimestamp(session: SessionItem | null | undefined): string {
    const confirmedAt = session?.confirmation?.autoConfirmedAt || session?.confirmation?.parentConfirmedAt;
    return confirmedAt ? this.formatDateTime(confirmedAt, '') : '';
  }

  cancellationSourceLabel(session: SessionItem | null | undefined): string {
    const cancelledBy = session?.cancellation?.cancelledBy;
    const labels: Record<string, string> = {
      TEACHER: 'Giáo viên',
      PARENT: 'Phụ huynh',
      OPS: 'OPS',
      SYSTEM: 'Hệ thống',
    };
    return cancelledBy ? labels[cancelledBy] || cancelledBy : '';
  }

  cancellationTimestamp(session: SessionItem | null | undefined): string {
    const cancelledAt = session?.cancellation?.cancelledAt;
    return cancelledAt ? this.formatDateTime(cancelledAt, '') : '';
  }

  timeColumnLabel(): string {
    return this.isTeacher() ? 'Gi\u1edd \u0111i\u1ec3m danh' : 'Gi\u1edd';
  }

  showTuitionColumn(): boolean {
    return !this.isTeacher();
  }

  showTeacherPayoutColumn(): boolean {
    return !this.isParent();
  }

  payoutOrDurationColumnLabel(): string {
    return this.showTeacherPayoutColumn() ? 'L\u01b0\u01a1ng GV' : 'Th\u1eddi l\u01b0\u1ee3ng';
  }

  timeDisplay(session: SessionItem | null | undefined): string {
    if (!session) return '\u2014';
    return this.isTeacher()
      ? this.formatAttendanceTime(session.attendedAt)
      : this.formatScheduledWindow(session);
  }

  private formatAttendanceTime(attendedAt?: string | null): string {
    if (!attendedAt) return '\u2014';
    const date = new Date(attendedAt);
    if (Number.isNaN(date.getTime())) return '\u2014';
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatScheduledWindow(session: SessionItem): string {
    const start = session.scheduledStartTime?.trim();
    const end = session.scheduledEndTime?.trim();
    if (start && end) return `${start} \u2013 ${end}`;
    return start || end || '\u2014';
  }

  formatDuration(session: SessionItem | null | undefined): string {
    if (!session) return '\u2014';
    const explicitDuration = Number(session.durationMinutes ?? 0);
    if (Number.isFinite(explicitDuration) && explicitDuration > 0) {
      return `${Math.round(explicitDuration)} ph\u00fat`;
    }

    const startMinutes = this.parseTimeToMinutes(session.scheduledStartTime);
    const endMinutes = this.parseTimeToMinutes(session.scheduledEndTime);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return '\u2014';
    }
    return `${endMinutes - startMinutes} ph\u00fat`;
  }

  private parseTimeToMinutes(value?: string | null): number | null {
    const safeValue = value?.trim();
    if (!safeValue) return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(safeValue);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return (hours * 60) + minutes;
  }

  private calculateDurationMinutes(startTime?: string | null, endTime?: string | null): number | null {
    const startMinutes = this.parseTimeToMinutes(startTime);
    const endMinutes = this.parseTimeToMinutes(endTime);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return null;
    }
    return endMinutes - startMinutes;
  }

  private addMinutesToTime(startTime?: string | null, durationMinutes?: number | null): string | null {
    const startMinutes = this.parseTimeToMinutes(startTime);
    const safeDuration = Number(durationMinutes ?? 0);
    if (startMinutes === null || !Number.isFinite(safeDuration) || safeDuration <= 0) {
      return null;
    }

    const endMinutes = startMinutes + Math.round(safeDuration);
    if (endMinutes <= startMinutes || endMinutes > (24 * 60)) {
      return null;
    }

    const hours = Math.floor(endMinutes / 60);
    const minutes = endMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  sessionEditHistory(session: SessionItem | null | undefined): SessionEditHistoryEntry[] {
    return [...(session?.editHistory || [])].sort((left, right) => {
      const leftTime = new Date(left.editedAt).getTime();
      const rightTime = new Date(right.editedAt).getTime();
      return rightTime - leftTime;
    });
  }

  formatHistoryTimestamp(value?: string): string {
    if (!value) return 'Kh\u00f4ng r\u00f5 th\u1eddi gian';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Kh\u00f4ng r\u00f5 th\u1eddi gian';
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDateTime(value?: string, emptyLabel = 'Ch\u01b0a c\u00f3'): string {
    if (!value) return emptyLabel;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return emptyLabel;
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatOptionalText(value?: string | null, emptyLabel = 'Ch\u01b0a c\u1eadp nh\u1eadt'): string {
    const safeValue = value?.trim();
    return safeValue && safeValue.length > 0 ? safeValue : emptyLabel;
  }

  private formatShortDate(value?: string): string {
    if (!value) return 'Chưa rõ ngày';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  getRecordingUrl(session: SessionItem | null | undefined): string | null {
    const safeValue = session?.teachingReport?.recordingUrl?.trim();
    return safeValue || null;
  }

  roleLabel(role?: string): string {
    const map: Record<string, string> = {
      DIRECTOR: 'Gi\u00e1m \u0111\u1ed1c',
      OPS: 'V\u1eadn h\u00e0nh',
      ACCOUNTING: 'K\u1ebf to\u00e1n',
      TEACHER: 'Gi\u00e1o vi\u00ean',
      PARENT: 'Ph\u1ee5 huynh',
      SALE: 'Sale',
      ADSMANAGER: 'Ads',
    };
    if (!role) return '';
    return map[role] || role;
  }

  formatSessionCount(value?: number): string {
    const safeValue = Number(value || 0);
    return Math.max(Math.floor(safeValue), 0).toLocaleString('vi-VN');
  }

  changeRequestHistory(): SessionChangeRequestItem[] {
    return this.sortChangeRequests(this.changeRequests());
  }

  formatChangeRequestStatus(status?: string): string {
    const map: Record<string, string> = {
      PENDING: 'Chờ duyệt',
      APPROVED: 'Đã duyệt',
      REJECTED: 'Từ chối',
      CANCELLED: 'Đã hủy',
    };
    return map[`${status || ''}`] || (status || 'Không rõ');
  }

  changeRequestScheduleLabel(request: SessionChangeRequestItem): string {
    const currentDate = this.formatShortDate(request.currentScheduledDate || request.sessionId?.scheduledDate);
    const currentStart = `${request.currentStartTime || request.sessionId?.scheduledStartTime || ''}`.trim();
    const currentEnd = `${request.currentEndTime || request.sessionId?.scheduledEndTime || ''}`.trim();
    const requestedDate = this.formatShortDate(request.requestedScheduledDate || request.currentScheduledDate || request.sessionId?.scheduledDate);
    const requestedStart = `${request.requestedStartTime || request.currentStartTime || request.sessionId?.scheduledStartTime || ''}`.trim();
    const requestedEnd = `${request.requestedEndTime || request.currentEndTime || request.sessionId?.scheduledEndTime || ''}`.trim();
    return `${currentDate} ${currentStart} - ${currentEnd} -> ${requestedDate} ${requestedStart} - ${requestedEnd}`;
  }

  changeRequestTeacherLabel(request: SessionChangeRequestItem): string {
    const currentTeacher = request.currentTeacherId?.fullName || 'Giáo viên hiện tại';
    const requestedTeacher = request.requestedTeacherId?.fullName || currentTeacher;
    return `${currentTeacher} -> ${requestedTeacher}`;
  }

  changeRequestDurationLabel(request: SessionChangeRequestItem): string {
    const nextDuration = request.requestedDurationMinutes ?? request.currentDurationMinutes;
    return `${request.currentDurationMinutes} phút -> ${nextDuration} phút`;
  }

  changeRequestDecisionNote(request: SessionChangeRequestItem): string {
    if (request.status === 'REJECTED' && request.rejectionReason) {
      return `Lý do từ chối: ${request.rejectionReason}`;
    }
    if (request.reviewedBy?.fullName && request.reviewedAt) {
      return `${this.formatChangeRequestStatus(request.status)} bởi ${request.reviewedBy.fullName} lúc ${this.formatDateTime(request.reviewedAt, '')}`;
    }
    return '';
  }

  canRequestSessionChange(session: SessionItem | null | undefined): boolean {
    return !!session && this.isSale() && session.status === 'SCHEDULED';
  }

  canRescheduleSession(session: SessionItem | null | undefined): boolean {
    return !!session && this.canCreate() && session.status === 'SCHEDULED';
  }

  canCreate(): boolean {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'OPS';
  }

  canParentConfirmSession(session: SessionItem | null | undefined): boolean {
    return !!session
      && this.isParent()
      && session.status === 'TEACHER_COMPLETED'
      && !!session.hasTeachingReport
      && !!session.teachingReport?.lessonContent?.trim();
  }

  canConfirmSalarySession(session: SessionItem): boolean {
    if (!this.canConfirmSalaryRole()) {
      return false;
    }

    if (!session.hasTeachingReport || !session.teachingReport?.lessonContent?.trim()) {
      return false;
    }

    if (session.status === 'TEACHER_COMPLETED' || session.status === 'PARENT_CONFIRMED') {
      return true;
    }

    return session.status === 'FINALIZED' && !this.hasManualPayrollConfirmation(session);
  }

  private canConfirmSalaryRole(): boolean {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'OPS' || role === 'ACCOUNTING';
  }

  private resetCompleteForm(): void {
    this.completeForm = { topicsCovered: '', homework: '', teacherNotes: '' };
    this.completeTouched = {
      topicsCovered: false,
      homework: false,
      teacherNotes: false,
    };
    this.completeSubmitAttempted = false;
  }

  private createGeneralFeedbackForm(target?: GeneralFeedbackTarget | null): GeneralFeedbackFormState {
    return {
      overallRating: 5,
      teachingQuality: 5,
      communication: 5,
      facility: 5,
      comment: '',
      studentId: target?.studentId || '',
      sessionId: target?.sessionId || '',
    };
  }

  private createChangeRequestForm(session?: SessionItem | null): SessionChangeRequestFormState {
    return {
      requestedScheduledDate: this.formatDateInput(session?.scheduledDate),
      requestedStartTime: `${session?.scheduledStartTime || ''}`.trim(),
      requestedTeacherId: '',
      reason: '',
    };
  }

  private normalizeChangeRequestForm(): SessionChangeRequestFormState {
    return {
      requestedScheduledDate: `${this.changeRequestForm.requestedScheduledDate || ''}`.trim(),
      requestedStartTime: `${this.changeRequestForm.requestedStartTime || ''}`.trim(),
      requestedTeacherId: `${this.changeRequestForm.requestedTeacherId || ''}`.trim(),
      reason: `${this.changeRequestForm.reason || ''}`.trim(),
    };
  }

  private createRescheduleForm(session?: SessionItem | null): SessionRescheduleFormState {
    return {
      newScheduledDate: this.formatDateInput(session?.scheduledDate),
      newStartTime: `${session?.scheduledStartTime || ''}`.trim(),
      newEndTime: `${session?.scheduledEndTime || ''}`.trim(),
      reason: '',
    };
  }

  private normalizeRescheduleForm(): SessionRescheduleFormState {
    return {
      newScheduledDate: `${this.rescheduleForm.newScheduledDate || ''}`.trim(),
      newStartTime: `${this.rescheduleForm.newStartTime || ''}`.trim(),
      newEndTime: `${this.rescheduleForm.newEndTime || ''}`.trim(),
      reason: `${this.rescheduleForm.reason || ''}`.trim(),
    };
  }

  private mergeSessionSnapshot(
    base: SessionItem,
    patch?: Partial<SessionItem> | null,
    overrides: Partial<SessionItem> = {},
  ): SessionItem {
    const merged = {
      ...base,
      ...(patch || {}),
      ...overrides,
    } as SessionItem;

    merged.classId = this.resolveSessionRelation(merged.classId, base.classId);
    merged.studentId = this.resolveSessionRelation(merged.studentId, base.studentId);
    merged.teacherId = this.resolveSessionRelation(merged.teacherId, base.teacherId);
    if (base.parentUserId) {
      merged.parentUserId = this.resolveSessionRelation(merged.parentUserId, base.parentUserId);
    }

    return merged;
  }

  private resolveSessionRelation<T>(value: T | string | null | undefined, fallback: T): T {
    if (!value || typeof value === 'string') {
      return fallback;
    }
    return value;
  }

  private toSessionReference(
    value: SessionItem | SessionReference | string | null | undefined,
  ): SessionReference | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      return { _id: value };
    }

    return {
      _id: value._id,
      scheduledDate: value.scheduledDate,
      scheduledStartTime: value.scheduledStartTime,
      scheduledEndTime: value.scheduledEndTime,
      status: value.status,
    };
  }

  private async loadTeacherOptions(session: SessionItem): Promise<void> {
    try {
      const teachers = await this.teacherSvc.getAllTeachers({ status: 'ACTIVE' });
      const options = teachers
        .map((profile) => this.toTeacherOption(profile))
        .filter((item): item is TeacherOption => !!item);
      const currentTeacherId = this.teacherUserId(session);
      const currentTeacherName = session.teacherId?.fullName || 'Giáo viên hiện tại';
      if (currentTeacherId && !options.some((item) => item.userId === currentTeacherId)) {
        options.unshift({ userId: currentTeacherId, fullName: currentTeacherName });
      }
      this.teacherOptions.set(options);
    } catch {
      const currentTeacherId = this.teacherUserId(session);
      if (currentTeacherId) {
        this.teacherOptions.set([{
          userId: currentTeacherId,
          fullName: session.teacherId?.fullName || 'Giáo viên hiện tại',
        }]);
      } else {
        this.teacherOptions.set([]);
      }
    }
  }

  private toTeacherOption(profile: TeacherProfile | null | undefined): TeacherOption | null {
    const user = profile?.userId;
    if (!user) {
      return null;
    }

    if (typeof user === 'string') {
      return {
        userId: user,
        fullName: `Giáo viên ${user.slice(-6)}`,
      };
    }

    if (!user._id) {
      return null;
    }

    return {
      userId: user._id,
      fullName: user.fullName || `Giáo viên ${user._id.slice(-6)}`,
    };
  }

  private teacherUserId(session: SessionItem | null | undefined): string {
    const teacher = session?.teacherId;
    if (!teacher) return '';
    if (typeof teacher === 'string') return teacher;
    return `${teacher._id || ''}`.trim();
  }

  private sessionDurationMinutes(session: SessionItem | null | undefined): number {
    if (!session) return 0;
    const explicitDuration = Number(session.durationMinutes ?? 0);
    if (Number.isFinite(explicitDuration) && explicitDuration > 0) {
      return Math.round(explicitDuration);
    }
    return this.calculateDurationMinutes(session.scheduledStartTime, session.scheduledEndTime) || 0;
  }

  private sortChangeRequests(requests: SessionChangeRequestItem[]): SessionChangeRequestItem[] {
    return [...requests].sort((left, right) => {
      const leftTime = new Date(left.requestedAt || '').getTime();
      const rightTime = new Date(right.requestedAt || '').getTime();
      return rightTime - leftTime;
    });
  }

  formatDateInput(value?: string | Date | null): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  private normalizeGeneralFeedbackForm(): GeneralFeedbackFormState {
    const normalizeRating = (value: number) => {
      const normalized = Number(value);
      if (!Number.isFinite(normalized)) {
        return 0;
      }
      return Math.max(1, Math.min(5, Math.round(normalized)));
    };

    return {
      overallRating: normalizeRating(this.generalFeedbackForm.overallRating),
      teachingQuality: normalizeRating(this.generalFeedbackForm.teachingQuality),
      communication: normalizeRating(this.generalFeedbackForm.communication),
      facility: normalizeRating(this.generalFeedbackForm.facility),
      comment: `${this.generalFeedbackForm.comment || ''}`.trim(),
      studentId: `${this.generalFeedbackForm.studentId || ''}`.trim(),
      sessionId: `${this.generalFeedbackForm.sessionId || ''}`.trim(),
    };
  }

  private isGeneralFeedbackFormValid(form: GeneralFeedbackFormState): boolean {
    const ratings = [
      form.overallRating,
      form.teachingQuality,
      form.communication,
      form.facility,
    ];
    return !!form.studentId
      && !!form.sessionId
      && ratings.every((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5);
  }

  private normalizeCompleteForm(): Record<CompleteField, string> {
    return {
      topicsCovered: `${this.completeForm.topicsCovered || ''}`.trim(),
      homework: `${this.completeForm.homework || ''}`.trim(),
      teacherNotes: `${this.completeForm.teacherNotes || ''}`.trim(),
    };
  }

  private isCompleteFormValid(form: Record<CompleteField, string>): boolean {
    return !!form.topicsCovered && !!form.homework && !!form.teacherNotes;
  }

  private hasManualPayrollConfirmation(session: SessionItem): boolean {
    const finalizedBy: any = session.confirmation?.finalizedBy;
    if (!finalizedBy) return false;
    if (typeof finalizedBy === 'string') return finalizedBy.trim().length > 0;
    if (finalizedBy._id) return true;
    if (typeof finalizedBy.toString === 'function') {
      const serialized = finalizedBy.toString();
      return !!serialized && serialized !== '[object Object]';
    }
    return false;
  }

  isTeacher(): boolean {
    return this.auth.userSignal()?.role === 'TEACHER';
  }

  isParent(): boolean {
    return this.auth.userSignal()?.role === 'PARENT';
  }

  isDirector(): boolean {
    return this.auth.userSignal()?.role === 'DIRECTOR';
  }

  isSale(): boolean {
    return this.auth.userSignal()?.role === 'SALE';
  }

  canSubmitReschedule(): boolean {
    const session = this.selectedSession();
    const form = this.normalizeRescheduleForm();
    if (this.submittingReschedule() || !session || !this.canRescheduleSession(session)) {
      return false;
    }

    if (!form.newScheduledDate || !form.newStartTime || !form.newEndTime) {
      return false;
    }

    const nextDurationMinutes = this.calculateDurationMinutes(form.newStartTime, form.newEndTime);
    if (!nextDurationMinutes) {
      return false;
    }

    const currentDate = this.formatDateInput(session.scheduledDate);
    const currentStartTime = `${session.scheduledStartTime || ''}`.trim();
    const currentEndTime = `${session.scheduledEndTime || ''}`.trim();

    return form.newScheduledDate !== currentDate
      || form.newStartTime !== currentStartTime
      || form.newEndTime !== currentEndTime;
  }

  canSubmitChangeRequest(): boolean {
    const session = this.selectedSession();
    const form = this.normalizeChangeRequestForm();
    if (this.submittingChangeRequest() || !session || !form.reason) {
      return false;
    }

    const currentTeacherId = this.teacherUserId(session);
    const currentDate = this.formatDateInput(session.scheduledDate);
    const currentStartTime = `${session.scheduledStartTime || ''}`.trim();
    const teacherChanged = !!form.requestedTeacherId && form.requestedTeacherId !== currentTeacherId;
    const dateChanged = !!form.requestedScheduledDate && form.requestedScheduledDate !== currentDate;
    const timeChanged = !!form.requestedStartTime && form.requestedStartTime !== currentStartTime;

    if (!teacherChanged && !dateChanged && !timeChanged) {
      return false;
    }

    return !timeChanged || !!this.addMinutesToTime(form.requestedStartTime, this.sessionDurationMinutes(session));
  }

  private extractUiErrorMessage(error: any, fallback: string): string {
    const payload = error?.error;
    if (Array.isArray(payload?.message)) {
      const message = payload.message.find((item: unknown) => typeof item === 'string' && item.trim());
      if (message) {
        return String(message).trim();
      }
    }
    if (typeof payload?.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
    if (typeof error?.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
    return fallback;
  }
}
