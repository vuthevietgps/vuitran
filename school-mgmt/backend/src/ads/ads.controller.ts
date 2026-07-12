import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { AdsService } from './ads.service';
import { AdsAnalyticsService } from './ads-analytics.service';
import { AdsOptimizationPlanService } from './ads-optimization-plan.service';
import { CreateAdAccountDto } from './dto/create-ad-account.dto';
import { UpdateAdAccountDto } from './dto/update-ad-account.dto';
import { QueryAdAccountDto } from './dto/query-ad-account.dto';
import { CreateAdGroupDto } from './dto/create-ad-group.dto';
import { UpdateAdGroupDto } from './dto/update-ad-group.dto';
import { QueryAdGroupDto } from './dto/query-ad-group.dto';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { UpdateApiTokenDto } from './dto/update-api-token.dto';
import { CreateAdCostDto } from './dto/create-ad-cost.dto';
import { QueryAdCostDto } from './dto/query-ad-cost.dto';
import { QueryAdsAnalyticsDto } from './dto/query-ads-analytics.dto';
import { QueryAdsProfitDto } from './dto/query-ads-profit.dto';
import { QueryAdsSuggestionsDto } from './dto/query-ads-suggestions.dto';
import { QueryActionsRequiredDto } from './dto/query-actions-required.dto';
import { QueryParentProfitDto } from './dto/query-parent-profit.dto';
import { QueryRealizedCohortDto } from './dto/query-realized-cohort.dto';
import { QuerySaleFunnelDiagnosticsDto } from './dto/query-sale-funnel-diagnostics.dto';
import {
  DecideAdsOptimizationPlanItemDto,
  ExecuteAdsOptimizationPlanDto,
  GenerateAdsOptimizationPlanDto,
  QueryAdsOptimizationFollowUpDto,
  QueryAdsOptimizationPlansDto,
} from './dto/ads-optimization-plan.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction, AuditModule } from '../audit-log/schemas/audit-log.schema';

@Controller('ads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdsController {
  constructor(
    private readonly adsAnalyticsService: AdsAnalyticsService,
    private readonly adsService: AdsService,
    private readonly adsOptimizationPlanService: AdsOptimizationPlanService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ─── Ad Accounts ────────────────────────────────────────

  @Get('accounts')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE, Role.ADSMANAGER)
  async findAllAccounts(@Query() query: QueryAdAccountDto) {
    return this.adsService.findAllAccounts(query);
  }

  @Get('accounts/:id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE, Role.ADSMANAGER)
  async findOneAccount(@Param('id', ParseMongoIdPipe) id: string) {
    return this.adsService.findOneAccount(id);
  }

  @Post('accounts')
  @Roles(Role.DIRECTOR)
  async createAccount(@Body() dto: CreateAdAccountDto, @Req() req: AuthenticatedRequest) {
    return this.adsService.createAccount(dto, req.user);
  }

  @Patch('accounts/:id')
  @Roles(Role.DIRECTOR)
  async updateAccount(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdateAdAccountDto) {
    return this.adsService.updateAccount(id, dto);
  }

  @Delete('accounts/:id')
  @Roles(Role.DIRECTOR)
  async deleteAccount(@Param('id', ParseMongoIdPipe) id: string) {
    await this.adsService.deleteAccount(id);
    return { message: 'Đã xóa tài khoản quảng cáo' };
  }

  // ─── Ad Groups ──────────────────────────────────────────

  @Get('groups')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE, Role.ADSMANAGER)
  async findAllGroups(@Query() query: QueryAdGroupDto) {
    return this.adsService.findAllGroups(query);
  }

  @Get('groups/all')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE, Role.ADSMANAGER)
  async findAllGroupsSimple() {
    return this.adsService.findAllGroupsSimple();
  }

  @Get('groups/by-platform/:platform')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE, Role.ADSMANAGER)
  async findGroupsByPlatform(@Param('platform') platform: string) {
    return this.adsService.findGroupsByPlatform(platform);
  }

  @Get('groups/:id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE, Role.ADSMANAGER)
  async findOneGroup(@Param('id', ParseMongoIdPipe) id: string) {
    return this.adsService.findOneGroup(id);
  }

  @Post('groups')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER)
  async createGroup(@Body() dto: CreateAdGroupDto, @Req() req: AuthenticatedRequest) {
    return this.adsService.createGroup(dto, req.user);
  }

  @Patch('groups/:id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER)
  async updateGroup(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdateAdGroupDto) {
    return this.adsService.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  @Roles(Role.DIRECTOR)
  async deleteGroup(@Param('id', ParseMongoIdPipe) id: string) {
    await this.adsService.deleteGroup(id);
    return { message: 'Đã xóa nhóm quảng cáo' };
  }

  // ─── API Tokens ─────────────────────────────────────────

  @Get('tokens')
  @Roles(Role.DIRECTOR)
  async findAllTokens(@Query('accountId') accountId?: string) {
    return accountId
      ? this.adsService.findTokensByAccount(accountId)
      : this.adsService.findAllTokens();
  }

  @Get('tokens/:accountId')
  @Roles(Role.DIRECTOR)
  async findTokens(@Param('accountId', ParseMongoIdPipe) accountId: string) {
    return this.adsService.findTokensByAccount(accountId);
  }

  @Post('tokens')
  @Roles(Role.DIRECTOR)
  async createToken(@Body() dto: CreateApiTokenDto, @Req() req: AuthenticatedRequest) {
    return this.adsService.createToken(dto, req.user);
  }

  @Patch('tokens/:id')
  @Roles(Role.DIRECTOR)
  async updateToken(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdateApiTokenDto) {
    return this.adsService.updateToken(id, dto);
  }

  @Delete('tokens/:id')
  @Roles(Role.DIRECTOR)
  async deleteToken(@Param('id', ParseMongoIdPipe) id: string) {
    await this.adsService.deleteToken(id);
    return { message: 'Đã xóa token' };
  }

  // ─── Ad Costs ───────────────────────────────────────────

  @Post('tokens/:id/sync-facebook-business')
  @Roles(Role.DIRECTOR)
  async syncFacebookBusinessToken(
    @Param('id', ParseMongoIdPipe) id: string,
    @Query('date') date?: string,
  ) {
    return this.adsService.syncFacebookBusinessToken(id, date);
  }

  @Post('tokens/:id/sync-google-mcc')
  @Roles(Role.DIRECTOR)
  async syncGoogleMccToken(
    @Param('id', ParseMongoIdPipe) id: string,
    @Query('date') date?: string,
  ) {
    return this.adsService.syncGoogleMccToken(id, date);
  }

  @Post('tokens/:id/sync-tiktok-business-center')
  @Roles(Role.DIRECTOR)
  async syncTikTokBusinessCenterToken(
    @Param('id', ParseMongoIdPipe) id: string,
    @Query('date') date?: string,
  ) {
    return this.adsService.syncTikTokBusinessCenterToken(id, date);
  }

  @Get('costs')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.ADSMANAGER)
  async findAllCosts(@Query() query: QueryAdCostDto) {
    return this.adsService.findAllCosts(query);
  }

  @Post('costs')
  @Roles(Role.DIRECTOR)
  async createCost(@Body() dto: CreateAdCostDto) {
    return this.adsService.createOrUpdateCost(dto);
  }

  @Delete('costs/:id')
  @Roles(Role.DIRECTOR)
  async deleteCost(@Param('id', ParseMongoIdPipe) id: string) {
    await this.adsService.deleteCost(id);
    return { message: 'Đã xóa bản ghi chi phí' };
  }

  // ─── Sync ───────────────────────────────────────────────

  @Post('sync')
  @Roles(Role.DIRECTOR)
  async triggerSync() {
    return this.adsService.syncAllAdCosts();
  }

  @Post('sync/:accountId')
  @Roles(Role.DIRECTOR)
  async triggerSyncAccount(
    @Param('accountId', ParseMongoIdPipe) accountId: string,
    @Query('date') date?: string,
  ) {
    const synced = await this.adsService.syncAccountCosts(accountId, date);
    return { synced };
  }

  // ─── Analytics ──────────────────────────────────────────

  @Get('analytics')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER, Role.SHAREHOLDER)
  async getAnalytics(@Query() query: QueryAdsAnalyticsDto) {
    return this.adsAnalyticsService.getAnalytics(
      query.startDate,
      query.endDate,
      query.adGroupId,
      query.platform,
      query.maturityDays,
      query.refundRatePercentX,
    );
  }

  @Get('analytics/profit')
  @Roles(Role.DIRECTOR, Role.SHAREHOLDER)
  async getNetProfitByAdGroup(@Query() query: QueryAdsProfitDto) {
    return this.adsAnalyticsService.getNetProfitByAdGroup(
      query.startDate,
      query.endDate,
      query.adGroupId,
    );
  }

  @Get('sale-funnel-diagnostics')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER, Role.SHAREHOLDER)
  async getSaleFunnelDiagnostics(@Query() query: QuerySaleFunnelDiagnosticsDto) {
    return this.adsAnalyticsService.getSaleFunnelDiagnostics(
      query.startDate,
      query.endDate,
      query.adGroupId,
      query.saleId,
    );
  }

  @Get('analytics/parents-profit')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER)
  async getParentProfitability(@Query() query: QueryParentProfitDto) {
    return this.adsAnalyticsService.getParentProfitability(
      query.startDate,
      query.endDate,
      query.adGroupId,
      query.platform,
    );
  }

  @Get('analytics/realized-cohort')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER)
  async getRealizedCohortAnalytics(@Query() query: QueryRealizedCohortDto) {
    return this.adsAnalyticsService.getRealizedCohortAnalytics(
      query.startDate,
      query.endDate,
      query.adGroupId,
      query.platform,
      query.maturityDays,
      query.refundRatePercentX,
    );
  }

  @Post('backfill-adgroup')
  @Roles(Role.DIRECTOR)
  async backfillAdGroupIds(@Req() req: AuthenticatedRequest) {
    const result = await this.adsService.backfillAdGroupIds();
    await this.auditLogService.log({
      userId: req.user._id,
      userEmail: req.user.email,
      userFullName: req.user.fullName,
      userRole: req.user.role,
      action: AuditAction.UPDATE,
      module: AuditModule.ADS,
      targetId: 'backfill-adgroup',
      targetName: 'Backfill adGroup',
      description: `Chay backfill adGroup cho du lieu cu: ${result.studentsUpdated} student, ${result.sessionsUpdated} session duoc cap nhat.`,
      newValue: {
        operation: 'BACKFILL_ADGROUP',
        studentsUpdated: result.studentsUpdated,
        sessionsUpdated: result.sessionsUpdated,
      },
      ipAddress: req.ip,
    });
    return result;
  }

  @Post('backfill-parent-attribution')
  @Roles(Role.DIRECTOR)
  async backfillParentAttribution(@Req() req: AuthenticatedRequest) {
    const result = await this.adsService.backfillParentAttribution();
    await this.auditLogService.log({
      userId: req.user._id,
      userEmail: req.user.email,
      userFullName: req.user.fullName,
      userRole: req.user.role,
      action: AuditAction.UPDATE,
      module: AuditModule.ADS,
      targetId: 'backfill-parent-attribution',
      targetName: 'Backfill parent attribution',
      description: `Chay backfill parent attribution: ${result.upserted} attribution duoc bo sung/cap nhat.`,
      newValue: {
        operation: 'BACKFILL_PARENT_ATTRIBUTION',
        conversations: result.conversations,
        leads: result.leads,
        orders: result.orders,
        students: result.students,
        upserted: result.upserted,
      },
      ipAddress: req.ip,
    });
    return result;
  }

  @Post('sync-revenue')
  @Roles(Role.DIRECTOR)
  async syncTrueRevenue(
    @Query('adGroupId') adGroupId: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.adsService.syncTrueRevenue(adGroupId);
    await this.auditLogService.log({
      userId: req.user._id,
      userEmail: req.user.email,
      userFullName: req.user.fullName,
      userRole: req.user.role,
      action: AuditAction.UPDATE,
      module: AuditModule.ADS,
      targetId: adGroupId ?? 'all',
      targetName: adGroupId ? `AdGroup ${adGroupId}` : 'Tat ca nhom quang cao',
      description: `Dong bo doanh thu thuc te: ${result.groupsProcessed} nhom duoc cap nhat, tong doanh thu=${result.totalRevenueUpdated}.`,
      newValue: {
        operation: 'SYNC_TRUE_REVENUE',
        adGroupId: adGroupId ?? null,
        groupsProcessed: result.groupsProcessed,
        totalLeadsUpdated: result.totalLeadsUpdated,
        totalRevenueUpdated: result.totalRevenueUpdated,
        errors: result.errors,
      },
      ipAddress: req.ip,
    });
    return result;
  }

  @Get('actions-required')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER)
  async getActionsRequired(@Query() query: QueryActionsRequiredDto) {
    return this.adsAnalyticsService.getActionsRequired({
      refundRatePercentX: query.refundRatePercentX,
      lookbackDays: query.lookbackDays,
      targetProfitableRatio: query.targetProfitableRatio,
      totalBudget: query.totalBudget,
    });
  }

  @Post('optimization-plans/generate')
  @Roles(Role.DIRECTOR, Role.ADSMANAGER)
  async generateOptimizationPlan(
    @Body() dto: GenerateAdsOptimizationPlanDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const plan = await this.adsOptimizationPlanService.generateFromActionsRequired(dto, req.user);
    await this.auditLogService.log({
      userId: req.user._id,
      userEmail: req.user.email,
      userFullName: req.user.fullName,
      userRole: req.user.role,
      action: AuditAction.CREATE,
      module: AuditModule.ADS,
      targetId: (plan as any)._id?.toString(),
      targetName: plan.title,
      description: `Generated ads optimization plan with ${plan.items?.length || 0} item(s).`,
      newValue: {
        operation: 'GENERATE_ADS_OPTIMIZATION_PLAN',
        planId: (plan as any)._id?.toString(),
        status: plan.status,
        itemCount: plan.items?.length || 0,
        generationOptions: plan.generationOptions,
      },
      ipAddress: req.ip,
    });
    return plan;
  }

  @Get('optimization-plans')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER)
  async findOptimizationPlans(@Query() query: QueryAdsOptimizationPlansDto) {
    return this.adsOptimizationPlanService.findAll(query);
  }

  @Get('optimization-plans/:id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER)
  async findOptimizationPlan(@Param('id', ParseMongoIdPipe) id: string) {
    return this.adsOptimizationPlanService.findOne(id);
  }

  @Post('optimization-plans/:id/items/:itemId/approve')
  @Roles(Role.DIRECTOR, Role.ADSMANAGER)
  async approveOptimizationPlanItem(
    @Param('id', ParseMongoIdPipe) id: string,
    @Param('itemId') itemId: string,
    @Body() dto: DecideAdsOptimizationPlanItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const plan = await this.adsOptimizationPlanService.approveItem(id, itemId, dto, req.user);
    await this.auditLogService.log({
      userId: req.user._id,
      userEmail: req.user.email,
      userFullName: req.user.fullName,
      userRole: req.user.role,
      action: AuditAction.APPROVE,
      module: AuditModule.ADS,
      targetId: id,
      targetName: plan.title,
      description: `Approved ads optimization item ${itemId}.`,
      newValue: {
        operation: 'APPROVE_ADS_OPTIMIZATION_ITEM',
        planId: id,
        itemId,
        status: plan.status,
      },
      ipAddress: req.ip,
    });
    return plan;
  }

  @Post('optimization-plans/:id/items/:itemId/reject')
  @Roles(Role.DIRECTOR, Role.ADSMANAGER)
  async rejectOptimizationPlanItem(
    @Param('id', ParseMongoIdPipe) id: string,
    @Param('itemId') itemId: string,
    @Body() dto: DecideAdsOptimizationPlanItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const plan = await this.adsOptimizationPlanService.rejectItem(id, itemId, dto, req.user);
    await this.auditLogService.log({
      userId: req.user._id,
      userEmail: req.user.email,
      userFullName: req.user.fullName,
      userRole: req.user.role,
      action: AuditAction.REJECT,
      module: AuditModule.ADS,
      targetId: id,
      targetName: plan.title,
      description: `Rejected ads optimization item ${itemId}.`,
      newValue: {
        operation: 'REJECT_ADS_OPTIMIZATION_ITEM',
        planId: id,
        itemId,
        status: plan.status,
      },
      ipAddress: req.ip,
    });
    return plan;
  }

  @Post('optimization-plans/:id/execute')
  @Roles(Role.DIRECTOR)
  async executeOptimizationPlan(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: ExecuteAdsOptimizationPlanDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.adsOptimizationPlanService.execute(id, dto, req.user);
    await this.auditLogService.log({
      userId: req.user._id,
      userEmail: req.user.email,
      userFullName: req.user.fullName,
      userRole: req.user.role,
      action: AuditAction.UPDATE,
      module: AuditModule.ADS,
      targetId: id,
      targetName: `Ads optimization plan ${id}`,
      description: `Executed ads optimization plan: ${result.executedCount} executed, ${result.skippedCount} skipped, ${result.failedCount} failed.`,
      newValue: {
        operation: 'EXECUTE_ADS_OPTIMIZATION_PLAN',
        ...result,
      },
      ipAddress: req.ip,
    });
    return result;
  }

  @Get('optimization-plans/:id/follow-up')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER)
  async getOptimizationPlanFollowUp(
    @Param('id', ParseMongoIdPipe) id: string,
    @Query() query: QueryAdsOptimizationFollowUpDto,
  ) {
    return this.adsOptimizationPlanService.getFollowUp(id, query.days);
  }

  @Get('suggestions')
  @Roles(Role.DIRECTOR)
  async getSuggestions(@Query() query: QueryAdsSuggestionsDto) {
    return this.adsAnalyticsService.getSuggestions(
      query.startDate,
      query.endDate,
      query.totalBudget,
      query.maturityDays,
      query.refundRatePercentX,
    );
  }
}
