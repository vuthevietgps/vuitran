import { Controller, Get, Patch, Post, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { User, UserDocument } from '../users/schemas/user.schema';
import { BulkNotificationDto } from './dto/bulk-notification.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  @Get()
  getMyNotifications(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.getMyNotifications(req.user.sub, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getUnreadCount(req.user.sub).then((count) => ({ count }));
  }

  @Post('bulk-preview')
  previewBulkNotification(
    @Req() req: AuthenticatedRequest,
    @Body() body: BulkNotificationDto,
  ) {
    return this.notificationsService.previewBulkNotification(req.user.role, body);
  }

  @Post('bulk-send')
  sendBulkNotification(
    @Req() req: AuthenticatedRequest,
    @Body() body: BulkNotificationDto,
  ) {
    return this.notificationsService.sendBulkNotification(req.user.role, body);
  }

  @Patch(':id/read')
  markAsRead(
    @Param('id', ParseMongoIdPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.markAsRead(id, req.user.sub);
  }

  @Patch('mark-all-read')
  markAllAsRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllAsRead(req.user.sub);
  }

  @Get('preferences')
  async getPreferences(@Req() req: AuthenticatedRequest) {
    const user = await this.userModel.findById(req.user.sub).select('enableEmailNotif enableZaloNotif enableSmsNotif phone').lean();
    return {
      enableEmailNotif: user?.enableEmailNotif || false,
      enableZaloNotif: user?.enableZaloNotif || false,
      enableSmsNotif: user?.enableSmsNotif || false,
      phone: user?.phone || '',
    };
  }

  @Patch('preferences')
  async updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body() body: { enableEmailNotif?: boolean; enableZaloNotif?: boolean; enableSmsNotif?: boolean; phone?: string },
  ) {
    const update: any = {};
    if (body.enableEmailNotif !== undefined) update.enableEmailNotif = body.enableEmailNotif;
    if (body.enableZaloNotif !== undefined) update.enableZaloNotif = body.enableZaloNotif;
    if (body.enableSmsNotif !== undefined) update.enableSmsNotif = body.enableSmsNotif;
    if (body.phone !== undefined) update.phone = body.phone;

    await this.userModel.findByIdAndUpdate(req.user.sub, { $set: update });
    return { success: true };
  }
}
