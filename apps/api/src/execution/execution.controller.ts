import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { ExecuteCodeDto } from './dto/execute-code.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@alex/database';

@Controller('api/v1/execution')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post('run')
  @Roles(Role.STUDENT, Role.ADMIN)
  submitCode(@Body() executeCodeDto: ExecuteCodeDto, @Req() req: any) {
    const userId = req.user.id;
    return this.executionService.submitExecution(executeCodeDto, userId);
  }

  @Get('status/:jobId')
  @Roles(Role.STUDENT, Role.ADMIN)
  getStatus(@Param('jobId') jobId: string, @Req() req: any) {
    const user = req.user;
    return this.executionService.getExecutionStatus(jobId, user.id, user.role);
  }
}
