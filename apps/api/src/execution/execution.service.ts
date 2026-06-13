import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ExecuteCodeDto } from './dto/execute-code.dto';
import { CodeExecutionRequest } from '@alex/shared-types';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ExecutionService {
  constructor(
    @InjectQueue('code-execution') private codeQueue: Queue,
    private redisService: RedisService,
  ) {}

  async submitExecution(dto: ExecuteCodeDto, userId: string) {
    const jobId = uuidv4();
    
    const request: CodeExecutionRequest = {
      jobId,
      language: dto.language,
      code: dto.code,
      questionId: dto.questionId,
      isSubmit: dto.isSubmit || false,
      customInput: dto.customInput,
      userId,
    };

    // Store initial pending state in Redis for polling
    await this.redisService.getClient().set(
      `job:${jobId}`, 
      JSON.stringify({ status: 'PENDING', jobId, userId }), 
      'EX', 
      300 // expire in 5 mins
    );

    await this.codeQueue.add('execute', request, {
      jobId,
      removeOnComplete: true,
      removeOnFail: true,
    });

    return { jobId, status: 'PENDING' };
  }

  async getExecutionStatus(jobId: string, userId: string, userRole: string) {
    const data = await this.redisService.getClient().get(`job:${jobId}`);
    if (!data) {
      throw new NotFoundException('Job not found or expired');
    }
    const job = JSON.parse(data);

    // Enforce ownership: students can only access their own jobs; admins/trainers can access any job.
    if (job.userId && job.userId !== userId && userRole !== 'ADMIN' && userRole !== 'TRAINER') {
      throw new ForbiddenException('You do not have permission to access this execution job');
    }
    return job;
  }
}
