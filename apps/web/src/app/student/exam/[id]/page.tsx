'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Editor } from '@monaco-editor/react';
import { Play, Send, Clock, AlertTriangle, ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react';
import Cookies from 'js-cookie';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ActiveAttemptPayload, QuestionData, DraftData } from '@alex/shared-types';
import { apiClient } from '@/lib/api-client';

export default function ExamInterface({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const examId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<ActiveAttemptPayload | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Local drafts cache: Maps questionId -> draftData object
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  
  // Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState('');
  const [customInput, setCustomInput] = useState('');

  // Session markers
  const sessionClientIdRef = useRef<string>('');
  const sequenceCountersRef = useRef<Record<string, number>>({});
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    sessionClientIdRef.current = Math.random().toString(36).substring(2, 15);
    fetchAttempt();

    // Proactively refresh access token every 10 minutes to prevent expiry during exam
    const proactiveRefresh = setInterval(async () => {
      try {
        await apiClient('/api/v1/auth/refresh', { method: 'POST', skipAuth: true });
        console.log('Proactively renewed access token');
      } catch (err) {
        console.error('Proactive token renewal failed:', err);
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(proactiveRefresh);
  }, [examId]);

  // Fetch or Start Attempt
  const fetchAttempt = async () => {
    setLoading(true);
    const token = Cookies.get('accessToken');
    if (!token) {
      toast.error('Session expired. Please log in again.');
      router.push('/login');
      return;
    }

    try {
      // 1. Try to resume active attempt
      const res = await apiClient(`/api/v1/student/attempts/active`);

      if (res.status === 200) {
        const data: ActiveAttemptPayload = await res.json();
        if (data.examId === examId) {
          initializeAttempt(data);
          return;
        }
      }

      // 2. If no active attempt or matches another exam, start new attempt
      const startRes = await apiClient(`/api/v1/student/attempts/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ examId })
      });

      if (!startRes.ok) {
        const errorData = await startRes.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to start exam attempt');
      }

      const data: ActiveAttemptPayload = await startRes.json();
      initializeAttempt(data);
    } catch (err: any) {
      toast.error(err.message || 'Error loading exam data');
      router.push('/student');
    }
  };

  const initializeAttempt = (payload: ActiveAttemptPayload) => {
    setAttempt(payload);
    setTimeLeft(payload.secondsRemaining);
    
    // Map initial drafts from database/cache
    const initialDrafts: Record<string, any> = {};
    payload.drafts.forEach((d) => {
      initialDrafts[d.questionId] = d.draftData;
    });
    setDrafts(initialDrafts);
    setLoading(false);
  };

  // Timer Countdown and Heartbeat loop
  useEffect(() => {
    if (!attempt || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Send heartbeats every 20 seconds
    const heartbeatTimer = setInterval(() => {
      sendHeartbeat();
    }, 20000);

    return () => {
      clearInterval(timer);
      clearInterval(heartbeatTimer);
    };
  }, [attempt, timeLeft]);

  const sendHeartbeat = async () => {
    if (!attempt) return;
    const token = Cookies.get('accessToken');
    if (!token) return;

    await apiClient(`/api/v1/student/attempts/${attempt.attemptId}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deviceId: sessionClientIdRef.current,
        browserInfo: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown'
      })
    }).catch(() => {});
  };

  const handleAutoSubmit = () => {
    toast.error('Exam time limit has expired. Your answers are being auto-submitted.');
    router.push('/student');
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion: QuestionData | undefined = attempt?.questions[activeIdx];

  // Save Draft to Backend (Debounced)
  const saveDraft = (questionId: string, data: any) => {
    // 1. Update local drafts state instantly
    setDrafts((prev) => ({
      ...prev,
      [questionId]: data,
    }));

    // 2. Clear existing save timeout for this question
    if (saveTimeoutRef.current[questionId]) {
      clearTimeout(saveTimeoutRef.current[questionId]);
    }

    // 3. Increment sequence counter
    if (!sequenceCountersRef.current[questionId]) {
      sequenceCountersRef.current[questionId] = 0;
    }
    sequenceCountersRef.current[questionId]++;
    const seq = sequenceCountersRef.current[questionId];

    setIsSaving(true);

    // 4. Set debounce timeout (1.5 seconds)
    saveTimeoutRef.current[questionId] = setTimeout(async () => {
      const token = Cookies.get('accessToken');
      if (!token || !attempt) return;

      try {
        const res = await apiClient(`/api/v1/student/attempts/${attempt.attemptId}/draft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            questionId,
            draftData: data,
            sequenceNumber: seq,
            clientTimestamp: Date.now(),
            sessionClientId: sessionClientIdRef.current
          })
        });

        if (res.status === 409) {
          toast.error('Concurrent session detected. Please refresh the page.');
          return;
        }

        if (res.ok) {
          setLastSaved(new Date());
        }
      } catch (err) {
        console.error('Failed to autosave draft:', err);
      } finally {
        setIsSaving(false);
      }
    }, 1500); // 1.5 seconds debounce (fixed from 15000)
  };

  // Compile / Run Sample Tests
  const handleRunCode = async () => {
    if (!currentQuestion || currentQuestion.type !== 'CODING' || !attempt) return;
    
    setIsExecuting(true);
    setOutput('Submitting code to execution queue...');

    const codingDraft = drafts[currentQuestion.id] || {};
    const codeVal = codingDraft.codeSnippet || 'def solve():\n    pass';
    const langVal = codingDraft.language || 'python';

    try {
      // Submit execution job
      const runRes = await apiClient(`/api/v1/execution/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          language: langVal,
          code: codeVal,
          questionId: currentQuestion.id,
          isSubmit: false,
          customInput: customInput.trim() !== '' ? customInput : undefined
        })
      });

      if (!runRes.ok) {
        throw new Error('Failed to submit code for run');
      }

      const { jobId } = await runRes.json();
      setOutput(`Job queued (ID: ${jobId}). Waiting for worker...`);

      // Poll status
      let attemptsCount = 0;
      const poll = setInterval(async () => {
        attemptsCount++;
        if (attemptsCount > 30) {
          clearInterval(poll);
          setIsExecuting(false);
          setOutput('Execution timed out (30s limits reached).');
          return;
        }

        const statusRes = await apiClient(`/api/v1/execution/status/${jobId}`);

        if (statusRes.ok) {
          const data = await statusRes.json();
          if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            clearInterval(poll);
            setIsExecuting(false);

            if (data.status === 'FAILED') {
              setOutput(`Execution Failed:\n${data.error || 'Unknown executor error'}`);
              return;
            }

            // Display test results
            let outStr = '';
            if (data.overallStatus === 'COMPILATION_ERROR') {
              outStr = `Compilation Error:\n${data.compileOutput || ''}`;
            } else {
              data.testResults?.forEach((res: any, index: number) => {
                if (res.testCaseId === 'custom') {
                  outStr += `Custom Execution Details:\n`;
                  outStr += `Status: ${res.status}\n`;
                  if (res.stdout) outStr += `Stdout:\n${res.stdout}\n`;
                  if (res.stderr) outStr += `Stderr:\n${res.stderr}\n`;
                  outStr += `Execution Time: ${res.executionTimeMs}ms\n\n`;
                } else {
                  outStr += `Test Case ${index + 1} (${res.testCaseId}): ${res.passed ? 'PASSED' : 'FAILED'} [${res.status}]\n`;
                  if (res.stdout) outStr += `Stdout:\n${res.stdout}\n`;
                  if (res.stderr) outStr += `Stderr:\n${res.stderr}\n`;
                  outStr += `Execution Time: ${res.executionTimeMs}ms\n\n`;
                }
              });
            }
            setOutput(outStr.trim());
          }
        }
      }, 1000);

    } catch (err: any) {
      setIsExecuting(false);
      setOutput(`Error: ${err.message}`);
    }
  };

  // Submit Attempt Manually
  const handleSubmitAttempt = async () => {
    if (!attempt) return;

    if (!confirm('Are you sure you want to submit your assessment? You cannot undo this action.')) {
      return;
    }

    setLoading(true);

    try {
      const res = await apiClient(`/api/v1/student/attempts/${attempt.attemptId}/submit`, {
        method: 'POST'
      });

      if (!res.ok) {
        throw new Error('Failed to finalize assessment submission.');
      }

      toast.success('Exam submitted successfully!');
      router.push('/student');
    } catch (err: any) {
      toast.error(err.message || 'Error submitting exam');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b] text-white">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
          <p className="text-zinc-400 text-sm">Loading assessment settings...</p>
        </div>
      </div>
    );
  }

  if (!attempt || !currentQuestion) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b] text-white">
        <p className="text-red-500">Failed to load active attempt data.</p>
      </div>
    );
  }

  // Helper values for current question draft
  const currentDraft = drafts[currentQuestion.id] || {};
  const currentCode = currentDraft.codeSnippet || '';
  const currentLang = currentDraft.language || 'python';

  return (
    <div className="flex flex-col h-screen max-h-screen bg-[#09090b] text-white">
      {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#09090b] flex-shrink-0">
        <div className="font-semibold text-lg flex items-center">
          <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded mr-3">EXAM</div>
          {attempt.questions.length > 1 ? 'Exam Mode' : 'Single Question Assessment'}
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="flex items-center text-zinc-400 text-sm">
            <Save className={`w-4 h-4 mr-2 ${isSaving ? 'animate-pulse text-blue-500' : ''}`} />
            {isSaving ? 'Autosaving...' : `Saved: ${lastSaved.toLocaleTimeString()}`}
          </div>
          <div className={`flex items-center font-mono font-bold text-lg ${timeLeft < 300 ? 'text-red-500' : 'text-white'}`}>
            <Clock className="w-5 h-5 mr-2" />
            {formatTime(timeLeft)}
          </div>
          <Button variant="destructive" size="sm" onClick={handleSubmitAttempt}>
            <Send className="w-4 h-4 mr-2" /> Submit Exam
          </Button>
        </div>
      </header>

      {/* Main Content Pane */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Side: Question List & Current Statement */}
        <div className="w-1/3 border-r border-white/10 flex flex-col bg-[#121214]">
          <div className="h-12 border-b border-white/10 flex items-center px-4 justify-between bg-[#121214] flex-shrink-0">
            <div className="flex space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-zinc-400" 
                disabled={activeIdx === 0}
                onClick={() => setActiveIdx((prev) => prev - 1)}
              >
                <ChevronLeft className="w-4 h-4 mr-1"/> Prev
              </Button>
              <div className="flex items-center px-3 text-sm font-medium">
                Q {activeIdx + 1} / {attempt.questions.length}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-zinc-400" 
                disabled={activeIdx === attempt.questions.length - 1}
                onClick={() => setActiveIdx((prev) => prev + 1)}
              >
                Next <ChevronRight className="w-4 h-4 ml-1"/>
              </Button>
            </div>
            <div className="text-sm font-medium text-blue-400">
              {currentQuestion.type} ({currentQuestion.marks} Marks)
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-6">
            <h2 className="text-xl font-bold mb-4">Question {activeIdx + 1}</h2>
            <div className="text-zinc-300 text-sm leading-relaxed mb-6 whitespace-pre-wrap">
              {currentQuestion.text}
            </div>

            {/* MCQ Option Render */}
            {currentQuestion.type === 'MCQ' && currentQuestion.mcqOptions && (
              <div className="space-y-3">
                {currentQuestion.mcqOptions.map((opt) => {
                  const isChecked = currentDraft.selectedOptionId === opt.id;
                  return (
                    <label 
                      key={opt.id} 
                      className={`flex items-start p-4 rounded-lg border cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-blue-600/10 border-blue-500 text-white' 
                          : 'bg-white/5 border-white/5 hover:border-white/10 text-zinc-300'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name={`mcq_${currentQuestion.id}`} 
                        className="mt-1 mr-3 h-4 w-4 accent-blue-500"
                        checked={isChecked}
                        onChange={() => saveDraft(currentQuestion.id, { selectedOptionId: opt.id })}
                      />
                      <span className="text-sm">{opt.optionText}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Coding Question constraints render */}
            {currentQuestion.type === 'CODING' && currentQuestion.codingQuestion && (
              <div className="space-y-6 border-t border-white/5 pt-6 mt-6">
                <div>
                  <h3 className="font-semibold text-white text-sm mb-2">Constraints:</h3>
                  <pre className="bg-white/5 p-3 rounded-md text-xs font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">
                    {currentQuestion.codingQuestion.constraints}
                  </pre>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-2">Sample Input:</h3>
                  <pre className="bg-white/5 p-3 rounded-md text-xs font-mono text-zinc-400 whitespace-pre-wrap">
                    {currentQuestion.codingQuestion.sampleInput}
                  </pre>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-2">Sample Output:</h3>
                  <pre className="bg-white/5 p-3 rounded-md text-xs font-mono text-zinc-400 whitespace-pre-wrap">
                    {currentQuestion.codingQuestion.sampleOutput}
                  </pre>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Side: Code Editor or MCQ Helper View */}
        <div className="w-2/3 flex flex-col">
          {currentQuestion.type === 'CODING' ? (
            <>
              {/* Editor Toolbar */}
              <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-[#121214] flex-shrink-0">
                <Select 
                  value={currentLang} 
                  onValueChange={(val) => saveDraft(currentQuestion.id, { codeSnippet: currentCode, language: val })}
                >
                  <SelectTrigger className="w-[180px] h-8 bg-transparent border-white/10 text-white">
                    <SelectValue placeholder="Select Language" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121214] border-white/10 text-white">
                    <SelectItem value="python">Python 3</SelectItem>
                    <SelectItem value="java">Java 21</SelectItem>
                    <SelectItem value="cpp">C++ 13</SelectItem>
                    <SelectItem value="javascript">JavaScript (Node)</SelectItem>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex space-x-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 border-white/10 bg-transparent hover:bg-white/5 text-zinc-300" 
                    onClick={handleRunCode} 
                    disabled={isExecuting}
                  >
                    <Play className="w-4 h-4 mr-2 text-emerald-500" />
                    Run Sample Tests
                  </Button>
                </div>
              </div>

              {/* Code Editor */}
              <div className="flex-1 overflow-hidden relative">
                <Editor
                  height="100%"
                  language={currentLang}
                  theme="vs-dark"
                  value={currentCode}
                  onChange={(val) => saveDraft(currentQuestion.id, { codeSnippet: val || '', language: currentLang })}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: 'JetBrains Mono, monospace',
                    padding: { top: 16 },
                    scrollBeyondLastLine: false,
                  }}
                />
              </div>

              {/* Console Results Output */}
              <div className="h-64 border-t border-white/10 bg-[#0c0c0e] flex flex-col flex-shrink-0">
                <Tabs defaultValue="console" className="flex-1 flex flex-col h-full">
                  <div className="h-10 border-b border-white/10 px-4 flex items-center bg-[#121214] flex-shrink-0">
                    <TabsList className="bg-transparent h-8 p-0 space-x-6">
                      <TabsTrigger value="console" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none h-10 text-zinc-400 data-[state=active]:text-white">
                        Test Results
                      </TabsTrigger>
                      <TabsTrigger value="custom" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none h-10 text-zinc-400 data-[state=active]:text-white">
                        Custom Input
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="console" className="flex-1 p-0 m-0 overflow-auto">
                    <div className="p-4 font-mono text-sm leading-relaxed">
                      {isExecuting ? (
                        <span className="text-zinc-400 animate-pulse">{output}</span>
                      ) : output ? (
                        <pre className="text-zinc-300 whitespace-pre-wrap">{output}</pre>
                      ) : (
                        <span className="text-zinc-500">Run code to see sample execution tests.</span>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="custom" className="flex-1 p-4 m-0">
                    <textarea 
                      className="w-full h-full bg-[#121214] border border-white/10 rounded-md p-3 text-white font-mono text-sm focus:outline-none focus:border-blue-500 resize-none"
                      placeholder="Enter custom input to feed into stdin..."
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                    ></textarea>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : (
            // Non-coding layout helper
            <div className="flex-1 flex items-center justify-center bg-[#0c0c0e] p-12 text-center text-zinc-500">
              <div>
                <AlertTriangle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-white font-medium mb-1">Multiple Choice Question</h3>
                <p className="text-sm max-w-sm mx-auto">
                  Please review the question text on the left panel and select your option choice. Your selection will save automatically.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
