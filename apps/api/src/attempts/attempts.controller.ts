import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@alex/database';
import { AttemptsService } from './attempts.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { HeartbeatDto } from './dto/heartbeat.dto';

@Controller('api/v1/student/attempts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post('start')
  async startAttempt(@Req() req: any, @Body() dto: StartAttemptDto) {
    const userId = req.user.id;
    return this.attemptsService.startAttempt(userId, dto.examId);
  }

  @Get('active')
  async getActiveAttempt(@Req() req: any) {
    const userId = req.user.id;
    return this.attemptsService.resumeAttempt(userId);
  }

  @Post(':id/draft')
  async saveDraft(
    @Req() req: any,
    @Param('id') attemptId: string,
    @Body() dto: SaveDraftDto,
  ) {
    const userId = req.user.id;
    await this.attemptsService.saveDraft(
      userId,
      attemptId,
      dto.questionId,
      dto.draftData,
      dto.sequenceNumber,
      dto.clientTimestamp,
      dto.sessionClientId,
    );
    return { success: true, updatedAt: new Date() };
  }

  @Post(':id/heartbeat')
  async saveHeartbeat(
    @Req() req: any,
    @Param('id') attemptId: string,
    @Body() dto: HeartbeatDto,
  ) {
    const userId = req.user.id;
    await this.attemptsService.saveHeartbeat(
      userId,
      attemptId,
      dto.deviceId,
      dto.browserInfo,
    );
    return { success: true, lastSeen: new Date() };
  }

  @Get('assignments')
  async getAssignments(@Req() req: any) {
    const userId = req.user.id;
    return this.attemptsService.getStudentAssignments(userId);
  }

  @Get('results')
  async getResults(@Req() req: any) {
    const userId = req.user.id;
    return this.attemptsService.getStudentResults(userId);
  }

  @Get('metrics')
  async getMetrics() {
    return this.attemptsService.getMetrics();
  }

  @Post(':id/submit')
  async submitAttempt(@Req() req: any, @Param('id') attemptId: string) {
    const userId = req.user.id;
    await this.attemptsService.submitAttempt(userId, attemptId);
    return { success: true, status: 'SUBMITTED', submittedAt: new Date() };
  }
}
