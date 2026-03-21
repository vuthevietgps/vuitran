import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('payroll')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  async exportPayroll(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('status') status: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportPayrollCsv({ fromDate, toDate, status }, req.user);
    this.sendCsv(res, csv, 'bang-luong');
  }

  @Get('invoices')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  async exportInvoices(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('status') status: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportInvoicesCsv({ fromDate, toDate, status }, req.user);
    this.sendCsv(res, csv, 'hoa-don');
  }

  @Get('students')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ACCOUNTING)
  async exportStudents(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportStudentsCsv(req.user);
    this.sendCsv(res, csv, 'hoc-sinh');
  }

  @Get('financial')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  async exportFinancial(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportFinancialCsv({ fromDate, toDate }, req.user);
    this.sendCsv(res, csv, 'tai-chinh');
  }

  @Get('attendance')
  @Roles(Role.DIRECTOR, Role.OPS)
  async exportAttendance(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportAttendanceCsv({ fromDate, toDate }, req.user);
    this.sendCsv(res, csv, 'diem-danh');
  }

  @Get('ads-parent-profit')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  async exportAdsParentProfit(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('adGroupId') adGroupId: string,
    @Query('platform') platform: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportAdsParentProfitCsv(
      { startDate, endDate, adGroupId, platform },
      req.user,
    );
    this.sendCsv(res, csv, 'ads-parent-profit');
  }

  @Get('ads-realized-cohort')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  async exportAdsRealizedCohort(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('maturityDays') maturityDays: string,
    @Query('adGroupId') adGroupId: string,
    @Query('platform') platform: string,
    @Query('refundRatePercentX') refundRatePercentX: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportAdsRealizedCohortCsv(
      { startDate, endDate, maturityDays, adGroupId, platform, refundRatePercentX },
      req.user,
    );
    this.sendCsv(res, csv, 'ads-realized-cohort');
  }

  private sendCsv(res: Response, csv: string, filename: string) {
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}_${date}.csv"`);
    res.send(csv);
  }
}
