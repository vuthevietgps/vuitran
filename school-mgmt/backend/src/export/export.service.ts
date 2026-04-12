import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payroll, PayrollDocument } from '../payroll/schemas/payroll.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { LedgerEntry, LedgerEntryDocument } from '../wallets/schemas/ledger-entry.schema';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction, AuditModule } from '../audit-log/schemas/audit-log.schema';
import { buildDateFilter } from '../common/utils/date.utils';
import { AdsService } from '../ads/ads.service';
import { AdsAnalyticsService } from '../ads/ads-analytics.service';
import { FinancialControlService } from '../financial-control/financial-control.service';

@Injectable()
export class ExportService {
  constructor(
    @InjectModel(Payroll.name) private payrollModel: Model<PayrollDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(LedgerEntry.name) private ledgerModel: Model<LedgerEntryDocument>,
    private auditLogService: AuditLogService,
    private adsService: AdsService,
    private adsAnalyticsService: AdsAnalyticsService,
    private financialControlService: FinancialControlService,
  ) {}

  /** Export payroll data as CSV */
  async exportPayrollCsv(query: { fromDate?: string; toDate?: string; status?: string }, user: any): Promise<string> {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.fromDate || query.toDate) {
      filter.periodStart = {};
      if (query.fromDate) filter.periodStart.$gte = new Date(query.fromDate);
      if (query.toDate) filter.periodStart.$lte = new Date(query.toDate);
    }

    const data = await this.payrollModel
      .find(filter)
      .populate('teacherId', 'fullName email phone')
      .sort({ createdAt: -1 })
      .lean();

    const header = 'Mã lương,Giáo viên,Email,Kỳ bắt đầu,Kỳ kết thúc,Số buổi,Tổng brutto,Thưởng,Khấu trừ,Thực lĩnh,Trạng thái,Ngày tạo';
    const rows = data.map((p: any) => {
      const teacher = p.teacherId || {};
      return [
        p.payrollCode || '',
        teacher.fullName || '',
        teacher.email || '',
        p.periodStart ? new Date(p.periodStart).toLocaleDateString('vi-VN') : '',
        p.periodEnd ? new Date(p.periodEnd).toLocaleDateString('vi-VN') : '',
        p.totalSessions || 0,
        p.grossAmount || 0,
        p.bonusAmount || 0,
        p.deductionAmount || 0,
        p.netAmount || 0,
        p.status || '',
        p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : '',
      ].join(',');
    });

    await this.logExport(user, 'payroll', data.length);
    return '\uFEFF' + [header, ...rows].join('\n');
  }

  /** Export invoices as CSV */
  async exportInvoicesCsv(query: { fromDate?: string; toDate?: string; status?: string }, user: any): Promise<string> {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
    }

    const data = await this.invoiceModel
      .find(filter)
      .populate('studentId', 'fullName')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    const header = 'Số hóa đơn,Học sinh,Loại,Số tiền,Trạng thái,Người tạo,Ngày tạo';
    const rows = data.map((inv: any) => {
      return [
        inv.invoiceNumber || '',
        inv.studentId?.fullName || '',
        inv.type || '',
        inv.totalAmount || inv.amount || 0,
        inv.status || '',
        inv.createdBy?.fullName || '',
        inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('vi-VN') : '',
      ].join(',');
    });

    await this.logExport(user, 'invoices', data.length);
    return '\uFEFF' + [header, ...rows].join('\n');
  }

  /** Export students as CSV */
  async exportStudentsCsv(user: any): Promise<string> {
    const data = await this.studentModel.find().sort({ fullName: 1 }).lean();

    const header = 'Họ tên,Ngày sinh,Giới tính,Lớp,Trường,Phụ huynh,SĐT PH,Trạng thái,Ngày tạo';
    const rows = data.map((s: any) => {
      return [
        s.fullName || '',
        s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('vi-VN') : '',
        s.gender || '',
        s.grade || '',
        s.school || '',
        s.parentName || '',
        s.parentPhone || '',
        s.status || 'ACTIVE',
        s.createdAt ? new Date(s.createdAt).toLocaleDateString('vi-VN') : '',
      ].join(',');
    });

    await this.logExport(user, 'students', data.length);
    return '\uFEFF' + [header, ...rows].join('\n');
  }

  /** Export financial summary (ledger) as CSV */
  async exportFinancialCsv(query: { fromDate?: string; toDate?: string }, user: any): Promise<string> {
    const filter: any = {};
    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
    }

    const data = await this.ledgerModel
      .find(filter)
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();

    const header = 'Ngày,Loại GD,Trạng thái,Số tiền,SD trước,SD sau,Người dùng,Email,Mô tả,PT thanh toán';
    const rows = data.map((e: any) => {
      return [
        e.createdAt ? new Date(e.createdAt).toLocaleDateString('vi-VN') : '',
        e.type || '',
        e.status || '',
        e.amount || 0,
        e.balanceBefore || 0,
        e.balanceAfter || 0,
        e.userId?.fullName || '',
        e.userId?.email || '',
        (e.description || '').replace(/,/g, ';'),
        e.paymentMethod || '',
      ].join(',');
    });

    await this.logExport(user, 'financial', data.length);
    return '\uFEFF' + [header, ...rows].join('\n');
  }

  /** Export attendance as CSV */
  async exportAttendanceCsv(query: { fromDate?: string; toDate?: string }, user: any): Promise<string> {
    const filter: any = {};
    const dateFilter = buildDateFilter(query.fromDate, query.toDate);
    if (dateFilter) filter.date = dateFilter;

    const data = await this.attendanceModel
      .find(filter)
      .populate('studentId', 'fullName')
      .populate('classId', 'name code')
      .sort({ date: -1 })
      .lean();

    const header = 'Ngày,Lớp,Học sinh,Trạng thái,Ghi chú';
    const rows = data.map((a: any) => {
      return [
        a.date ? new Date(a.date).toLocaleDateString('vi-VN') : '',
        a.classId?.name || '',
        a.studentId?.fullName || '',
        a.status || '',
        (a.notes || a.note || '').replace(/,/g, ';'),
      ].join(',');
    });

    await this.logExport(user, 'attendance', data.length);
    return '\uFEFF' + [header, ...rows].join('\n');
  }

  async exportInvestorSummaryCsv(query: { monthCount?: string | number }, user: any): Promise<string> {
    const [metrics, agingReport] = await Promise.all([
      this.financialControlService.getInvestorMetrics(query.monthCount),
      this.financialControlService.getAgingReport(user),
    ]);

    const monthCount = Number(metrics?.trend?.monthCount || query.monthCount || 6);
    const summary = agingReport?.summary || {};
    const details = Array.isArray(agingReport?.details) ? agingReport.details : [];

    const header = this.csvRow([
      'Section',
      'Metric',
      'Value',
      'Parent',
      'Masked phone',
      'Students',
      'Bucket',
      'Notes',
    ]);

    const rows = [
      this.csvRow(['Snapshot', 'Cash on hand', metrics?.snapshot?.cashOnHand || 0, '', '', '', '', `Khung ${monthCount} thang`]),
      this.csvRow(['Snapshot', 'Total fund balance', metrics?.snapshot?.totalFundBalance || 0, '', '', '', '', '']),
      this.csvRow(['Snapshot', 'Burn rate', metrics?.snapshot?.burnRate || 0, '', '', '', '', '']),
      this.csvRow(['Snapshot', 'Runway', metrics?.snapshot?.runway || 0, '', '', '', '', '']),
      this.csvRow(['Revenue', 'Recognized revenue this month', metrics?.revenue?.recognizedRevenue?.thisMonth || 0, '', '', '', '', '']),
      this.csvRow(['Revenue', 'Recognized revenue YTD', metrics?.revenue?.recognizedRevenue?.ytd || 0, '', '', '', '', '']),
      this.csvRow(['Profitability', 'Gross profit', metrics?.profitability?.grossProfit || 0, '', '', '', '', '']),
      this.csvRow(['Profitability', 'Net profit', metrics?.profitability?.netProfit || 0, '', '', '', '', '']),
      this.csvRow(['Customer base', 'Active students', metrics?.customerBase?.activeStudents || 0, '', '', '', '', '']),
      this.csvRow(['Customer base', 'Enrolled students', metrics?.customerBase?.enrolledStudents || 0, '', '', '', '', '']),
      this.csvRow(['Aging summary', 'Total AR', summary.totalAR || 0, '', '', '', '', '']),
      this.csvRow(['Aging summary', 'Current bucket', summary.current || 0, '', '', '', 'current', '']),
      this.csvRow(['Aging summary', '1-30 bucket', summary['1-30'] || 0, '', '', '', '1-30', '']),
      this.csvRow(['Aging summary', '31-60 bucket', summary['31-60'] || 0, '', '', '', '31-60', '']),
      this.csvRow(['Aging summary', '61-90 bucket', summary['61-90'] || 0, '', '', '', '61-90', '']),
      this.csvRow(['Aging summary', '90+ bucket', summary['90+'] || 0, '', '', '', '90+', '']),
      ...details.map((detail: any) => this.csvRow([
        'Aging detail',
        'Outstanding receivable',
        detail?.totalDebt || 0,
        detail?.parentName || '',
        detail?.parentPhone || 'An danh',
        Array.isArray(detail?.students) ? detail.students.join(' / ') : '',
        detail?.bucket || '',
        `${Array.isArray(detail?.items) ? detail.items.length : 0} chi tiet`,
      ])),
    ];

    await this.logExport(user, 'investor-summary', details.length, {
      targetId: 'export-investor-summary',
      targetName: 'Export investor summary',
      description: `Xuat bao cao co dong ${monthCount} thang (${details.length} dong aging).`,
      newValue: {
        monthCount,
        rowCount: rows.length,
        masked: user?.role === 'SHAREHOLDER',
      },
    });

    return '\uFEFF' + [header, ...rows].join('\n');
  }

  async exportAdsParentProfitCsv(query: {
    startDate?: string;
    endDate?: string;
    adGroupId?: string;
    platform?: string;
  }, user: any): Promise<string> {
    const { startDate, endDate } = this.requireAdsDateRange(query.startDate, query.endDate);
    const report = await this.adsAnalyticsService.getParentProfitability(
      startDate,
      endDate,
      query.adGroupId,
      query.platform,
    );

    const header = this.csvRow([
      'Report start',
      'Report end',
      'Parent key',
      'Parent user id',
      'Parent name',
      'Parent phone',
      'Ad group',
      'Ad group id',
      'Platform',
      'Attributed at',
      'Sessions',
      'Students',
      'Revenue',
      'Teacher cost',
      'Direct parent expense',
      'Allocated group expense',
      'Allocated global overhead',
      'Allocated ad spend',
      'Net profit',
      'Net margin %',
    ]);
    const rows = report.rows.map((row) => this.csvRow([
      startDate,
      endDate,
      row.parentKey,
      row.parentUserId || '',
      row.parentName || '',
      row.parentPhone || '',
      row.adGroupName || '',
      row.adGroupId || '',
      row.platform || '',
      this.formatDateTime(row.attributedAt),
      row.sessionCount,
      row.studentCount,
      row.revenue,
      row.teacherCost,
      row.directParentExpense,
      row.allocatedGroupExpense,
      row.allocatedGlobalOverhead,
      row.allocatedAdSpend,
      row.netProfit,
      row.netMargin,
    ]));

    await this.logExport(user, 'ads-parent-profit', report.rows.length, {
      module: AuditModule.ADS,
      targetId: 'export-ads-parent-profit',
      targetName: 'Export ads parent profit',
      description: `Xuat report ads parent-profit tu ${startDate} den ${endDate} (${report.rows.length} dong).`,
      newValue: {
        startDate,
        endDate,
        adGroupId: query.adGroupId || null,
        platform: query.platform || null,
        rowCount: report.rows.length,
      },
    });

    return '\uFEFF' + [header, ...rows].join('\n');
  }

  async exportAdsRealizedCohortCsv(query: {
    startDate?: string;
    endDate?: string;
    maturityDays?: string | number;
    adGroupId?: string;
    platform?: string;
    refundRatePercentX?: string | number;
  }, user: any): Promise<string> {
    const { startDate, endDate } = this.requireAdsDateRange(query.startDate, query.endDate);
    const maturityDays = this.parseOptionalNumber(query.maturityDays);
    const refundRatePercentX = this.parseOptionalNumber(query.refundRatePercentX);
    const report = await this.adsAnalyticsService.getRealizedCohortAnalytics(
      startDate,
      endDate,
      query.adGroupId,
      query.platform,
      maturityDays,
      refundRatePercentX,
    );

    const header = this.csvRow([
      'Report start',
      'Report end',
      'Maturity days',
      'Refund rate X',
      'Acquire date',
      'Ad group',
      'Ad group id',
      'Platform',
      'Cohort age days',
      'Is matured',
      'Impressions',
      'Clicks',
      'Conversions',
      'Leads',
      'New parents',
      'Ad spend',
      'Collected revenue',
      'Remaining session units',
      'Net realized revenue',
      'Projected revenue',
      'Estimated remaining refund',
      'Estimated remaining teacher cost',
      'Estimated remaining other cost',
      'Teacher cost',
      'Direct parent expense',
      'Allocated group expense',
      'Allocated global overhead',
      'Net profit',
      'Projected net profit',
      'Effective net profit',
      'ROI %',
      'Projection basis',
    ]);
    const rows = report.rows.map((row) => this.csvRow([
      startDate,
      endDate,
      report.maturityDays,
      report.refundRatePercentX ?? '',
      row.date,
      row.adGroupName || '',
      row.adGroupId || '',
      row.platform || '',
      row.cohortAgeDays,
      row.isMatured ? 'YES' : 'NO',
      row.impressions,
      row.clicks,
      row.conversions,
      row.leadCount,
      row.newParentCount,
      row.adSpend,
      row.collectedRevenue,
      row.remainingSessionUnits,
      row.netRealizedRevenue,
      row.projectedRevenue,
      row.estimatedRemainingRefund,
      row.estimatedRemainingTeacherCost,
      row.estimatedRemainingOtherCost,
      row.teacherCost,
      row.directParentExpense,
      row.allocatedGroupExpense,
      row.allocatedGlobalOverhead,
      row.netProfit,
      row.projectedNetProfit,
      row.effectiveNetProfit,
      row.roi,
      row.projectionBasis,
    ]));

    await this.logExport(user, 'ads-realized-cohort', report.rows.length, {
      module: AuditModule.ADS,
      targetId: 'export-ads-realized-cohort',
      targetName: 'Export ads realized cohort',
      description: `Xuat report ads realized-cohort tu ${startDate} den ${endDate} (${report.rows.length} dong).`,
      newValue: {
        startDate,
        endDate,
        maturityDays: report.maturityDays,
        refundRatePercentX: report.refundRatePercentX,
        adGroupId: query.adGroupId || null,
        platform: query.platform || null,
        rowCount: report.rows.length,
      },
    });

    return '\uFEFF' + [header, ...rows].join('\n');
  }

  private requireAdsDateRange(startDate?: string, endDate?: string) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required for ads exports');
    }
    return { startDate, endDate };
  }

  private parseOptionalNumber(value?: string | number): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private formatDateTime(value?: string | Date | null) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  private csvRow(values: unknown[]) {
    return values.map((value) => this.csvEscape(value)).join(',');
  }

  private csvEscape(value: unknown) {
    const normalized = value === undefined || value === null
      ? ''
      : String(value).replace(/\r?\n/g, ' ').replace(/"/g, '""');
    return `"${normalized}"`;
  }

  private async logExport(
    user: any,
    reportType: string,
    recordCount: number,
    options: {
      module?: AuditModule;
      targetId?: string;
      targetName?: string;
      description?: string;
      newValue?: Record<string, any>;
    } = {},
  ) {
    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.EXPORT,
      module: options.module || AuditModule.USERS,
      targetId: options.targetId,
      targetName: options.targetName,
      description: options.description || `Xuat bao cao ${reportType} (${recordCount} ban ghi)`,
      newValue: options.newValue,
    });
  }
}
