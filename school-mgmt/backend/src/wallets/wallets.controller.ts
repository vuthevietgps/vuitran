import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WalletsService } from './wallets.service';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';

import { TopUpRequestDto } from './dto/top-up-request.dto';
import { ApproveTopUpDto } from './dto/approve-top-up.dto';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { QueryLedgerDto } from './dto/query-ledger.dto';
import { TransferDto } from './dto/transfer.dto';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('wallets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  // ── WALLET ──────────────────────────────────────────────────────

  /** PH xem ví của mình */
  @Get('me')
  @Roles(Role.PARENT)
  getMyWallet(@Req() req: AuthenticatedRequest) {
    return this.walletsService.getOrCreateWalletView(req.user.sub);
  }

  /** OPS/ACCOUNTING xem danh sách tất cả ví */
  @Get()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  getAllWallets(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.walletsService.getAllWallets(
      Number(page) || 1,
      Number(limit) || 20,
      search,
      status,
    );
  }

  /** Xem ví theo userId */
  @Get('user/:userId')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  getWalletByUser(@Param('userId', ParseMongoIdPipe) userId: string) {
    return this.walletsService.getWalletViewByUserId(userId);
  }

  /** Đóng băng ví */
  @Post('user/:userId/freeze')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  freezeWallet(@Param('userId', ParseMongoIdPipe) userId: string) {
    return this.walletsService.freezeWallet(userId);
  }

  /** Mở lại ví */
  @Post('user/:userId/unfreeze')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  unfreezeWallet(@Param('userId', ParseMongoIdPipe) userId: string) {
    return this.walletsService.unfreezeWallet(userId);
  }

  // ── TOP-UP ──────────────────────────────────────────────────────

  /** PH hoặc OPS tạo yêu cầu nạp tiền */
  @Post('top-up')
  @Roles(Role.PARENT, Role.OPS, Role.ACCOUNTING, Role.DIRECTOR)
  requestTopUp(@Body() dto: TopUpRequestDto, @Req() req: AuthenticatedRequest) {
    // PARENT chỉ được nạp tiền cho chính mình
    if (req.user.role === Role.PARENT && dto.userId !== req.user.sub) {
      throw new ForbiddenException('Bạn chỉ có thể nạp tiền cho ví của mình');
    }
    return this.walletsService.requestTopUp(dto, req.user.sub);
  }

  /** PH / OPS tải ảnh chứng từ nạp tiền */
  @Post('top-up/upload-receipt')
  @Roles(Role.PARENT, Role.OPS, Role.ACCOUNTING, Role.DIRECTOR)
  @UseInterceptors(FileInterceptor('file'))
  uploadTopUpReceipt(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Không có file được tải lên');
    return { url: `/uploads/wallets/${file.filename}` };
  }

  /** ACCOUNTING xem danh sách nạp tiền chờ duyệt */
  @Get('top-up/pending')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR)
  getPendingTopUps() {
    return this.walletsService.getPendingTopUps();
  }

  /** ACCOUNTING duyệt nạp tiền */
  @Post('top-up/:id/approve')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR)
  approveTopUp(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: ApproveTopUpDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.walletsService.approveTopUp(id, req.user.sub, dto);
  }

  /** ACCOUNTING từ chối nạp tiền */
  @Post('top-up/:id/reject')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR)
  rejectTopUp(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.walletsService.rejectTopUp(id, req.user.sub, reason);
  }

  // ── ADJUSTMENT ──────────────────────────────────────────────────

  /** ACCOUNTING/DIRECTOR điều chỉnh số dư thủ công */
  @Post('adjust')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR)
  adjustBalance(@Body() dto: AdjustBalanceDto, @Req() req: AuthenticatedRequest) {
    return this.walletsService.adjustBalance(dto, req.user.sub);
  }

  // ── TRANSFER (Chuyển tiền giữa ví — chỉ KẾ TOÁN) ──────────────

  /** Chuyển tiền từ ví này sang ví khác (chỉ ACCOUNTING / DIRECTOR) */
  @Post('transfer')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR)
  transfer(@Body() dto: TransferDto, @Req() req: AuthenticatedRequest) {
    return this.walletsService.transferBetweenWallets(dto, req.user.sub);
  }

  // ── LEDGER (Lịch sử giao dịch) ─────────────────────────────────

  /** PH xem lịch sử giao dịch của mình */
  @Get('me/ledger')
  @Roles(Role.PARENT)
  getMyLedger(@Req() req: AuthenticatedRequest, @Query() query: QueryLedgerDto) {
    return this.walletsService.queryLedger({ ...query, userId: req.user.sub });
  }

  /** ACCOUNTING/OPS xem lịch sử giao dịch (filter) */
  @Get('ledger')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  queryLedger(@Query() query: QueryLedgerDto) {
    return this.walletsService.queryLedger(query);
  }

  // ── STATS ───────────────────────────────────────────────────────

  /** Thống kê thu chi tổng hợp */
  @Get('stats/financial')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  getFinancialSummary(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.walletsService.getFinancialSummary(fromDate, toDate);
  }

  // ── SESSION EQUIVALENCE (Bảng quy đổi buổi học) ────────────────

  /**
   * Tính bảng quy đổi: với số dư ví hiện tại + per-minute rate từ Invoice,
   * PH / OPS có thể học bao nhiêu buổi ở từng loại thời lượng.
   *
   * VD: Invoice 3,800,000 / 20 buổi / 70 phút
   *   → 70 phút = 190,000 đ/buổi → 20 buổi
   *   → 90 phút = 244,286 đ/buổi → 15.56 buổi
   */
  @Get('session-equivalence')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.PARENT)
  getSessionEquivalence(
    @Query('studentId') studentId: string,
    @Query('classId') classId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!studentId || !classId) {
      throw new ForbiddenException('studentId và classId là bắt buộc');
    }
    return this.walletsService.getSessionEquivalence({
      studentId,
      classId,
      requesterParentUserId: req.user.role === Role.PARENT ? req.user.sub : undefined,
    });
  }

  // ── LEDGER BALANCE VERIFICATION (Đối soát số dư) ────────────────

  /**
   * DIRECTOR / ACCOUNTING chạy đối soát thủ công bất kỳ lúc nào.
   * Tự động chạy hàng đêm lúc 02:00 qua CRON.
   * Trả về danh sách ví bị sai lệch giữa system balance vs ledger.
   */
  @Post('verify-balances')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING)
  verifyBalances() {
    return this.walletsService.runManualLedgerVerification();
  }
}
