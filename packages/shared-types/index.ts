export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    name?: string;
  };
}

export interface CodeExecutionRequest {
  jobId?: string;
  language: string;
  code: string;
  questionId: string;
  isSubmit: boolean;
  customInput?: string;
  userId?: string;
}

export interface CodeExecutionResult {
  jobId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  testResults?: {
    testCaseId: string;
    passed: boolean;
    stdout: string;
    stderr: string;
    executionTimeMs: number;
    memoryUsedKb: number;
  }[];
}

export interface MCQOptionData {
  id: string;
  optionText: string;
}

export interface CodingQuestionData {
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
}

export interface QuestionData {
  id: string;
  type: 'MCQ' | 'CODING';
  text: string;
  order: number;
  marks: number;
  mcqOptions?: MCQOptionData[];
  codingQuestion?: CodingQuestionData;
}

export interface DraftData {
  questionId: string;
  draftData: any;
}

export interface ActiveAttemptPayload {
  attemptId: string;
  examId: string;
  startTime: string | Date;
  secondsRemaining: number;
  status: 'ACTIVE' | 'SUBMITTED' | 'AUTO_SUBMITTED';
  questions: QuestionData[];
  drafts: DraftData[];
}

export interface SaveDraftRequest {
  questionId: string;
  draftData: any;
}

