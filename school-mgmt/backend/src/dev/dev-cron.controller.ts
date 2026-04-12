import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/interfaces/role.enum';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { SessionCronService } from '../sessions/session-cron.service';
import {
  Session,
  SessionDocument,
  SessionStatus,
} from '../sessions/schemas/session.schema';

@Controller('api/dev/cron')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevCronController {
  constructor(
    private readonly sessionCronService: SessionCronService,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  @Post('trigger-auto-finalize')
  @HttpCode(200)
  @Roles(Role.DIRECTOR, Role.OPS)
  async triggerAutoFinalize() {
    await this.sessionCronService.autoConfirmSessions();
    return { ok: true };
  }

  @Post('seed-auto-finalize/:id')
  @HttpCode(200)
  @Roles(Role.DIRECTOR, Role.OPS)
  async seedAutoFinalize(
    @Param('id', ParseMongoIdPipe) sessionId: string,
    @Body() body: { hoursAgo?: number } = {},
  ) {
    const requestedHoursAgo = Number(body?.hoursAgo);
    const hoursAgo =
      Number.isFinite(requestedHoursAgo) && requestedHoursAgo > 0
        ? Math.floor(requestedHoursAgo)
        : 2;
    const teacherCompletedAt = new Date(
      Date.now() - hoursAgo * 60 * 60 * 1000,
    );

    const updated = await this.sessionModel
      .findOneAndUpdate(
        {
          _id: sessionId,
          status: SessionStatus.TEACHER_COMPLETED,
          hasTeachingReport: true,
          'teachingReport.lessonContent': { $exists: true, $ne: '' },
        },
        {
          $set: {
            'confirmation.teacherCompletedAt': teacherCompletedAt,
          },
        },
        { new: true },
      )
      .lean();

    if (!updated) {
      throw new NotFoundException(
        'Eligible TEACHER_COMPLETED session not found for auto-finalize seeding',
      );
    }

    return {
      ok: true,
      sessionId,
      teacherCompletedAt,
    };
  }
}
