'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Code, List, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { StatusBadge } from '@/components/status-badge';

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Common fields
  const [difficulty, setDifficulty] = useState('Easy');
  const [marks, setMarks] = useState('');
  const [tagsStr, setTagsStr] = useState('');

  // Coding specific
  const [problemStatement, setProblemStatement] = useState('');
  const [constraints, setConstraints] = useState('');
  const [sampleInput, setSampleInput] = useState('');
  const [sampleOutput, setSampleOutput] = useState('');

  // MCQ specific
  const [mcqText, setMcqText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOption, setCorrectOption] = useState<'A' | 'B' | 'C' | 'D'>('A');

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res = await apiClient('/api/v1/admin/questions');
      if (res.ok) {
        const data = await res.json();
        setQuestions(data);
      } else {
        toast.error('Failed to load questions');
      }
    } catch (err) {
      console.error('Error loading questions:', err);
      toast.error('Error connecting to the server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const handleSaveCoding = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await apiClient('/api/v1/admin/questions/coding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemStatement,
          constraints,
          sampleInput,
          sampleOutput,
          marks: parseInt(marks, 10),
          difficulty,
          tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
          testCases: [
            {
              input: sampleInput,
              expectedOutput: sampleOutput,
              isHidden: false,
              weightage: 10
            }
          ]
        })
      });

      if (res.ok) {
        toast.success('Coding question added successfully');
        setIsDialogOpen(false);
        clearFields();
        loadQuestions();
      } else {
        const errData = await res.json();
        toast.error(errData.message || 'Failed to save coding question');
      }
    } catch (err) {
      toast.error('Connection error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveMCQ = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const options = [
        { optionText: optionA, isCorrect: correctOption === 'A' },
        { optionText: optionB, isCorrect: correctOption === 'B' },
        { optionText: optionC, isCorrect: correctOption === 'C' },
        { optionText: optionD, isCorrect: correctOption === 'D' },
      ].filter(o => o.optionText.trim() !== '');

      if (options.length < 2) {
        toast.error('Please enter at least 2 options');
        setIsSubmitting(false);
        return;
      }

      const res = await apiClient('/api/v1/admin/questions/mcq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: mcqText,
          marks: parseInt(marks, 10),
          difficulty,
          tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
          options
        })
      });

      if (res.ok) {
        toast.success('MCQ question added successfully');
        setIsDialogOpen(false);
        clearFields();
        loadQuestions();
      } else {
        const errData = await res.json();
        toast.error(errData.message || 'Failed to save MCQ');
      }
    } catch (err) {
      toast.error('Connection error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await apiClient(`/api/v1/admin/questions/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Question deleted successfully');
        loadQuestions();
      } else {
        toast.error('Failed to delete question');
      }
    } catch (err) {
      toast.error('Server error');
    }
  };

  const clearFields = () => {
    setDifficulty('Easy');
    setMarks('');
    setTagsStr('');
    setProblemStatement('');
    setConstraints('');
    setSampleInput('');
    setSampleOutput('');
    setMcqText('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setCorrectOption('A');
  };

  const mcqs = questions.filter(q => q.type === 'MCQ');
  const codings = questions.filter(q => q.type === 'CODING');

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Question Bank</h1>
          <p className="text-sm text-muted-foreground">Build reusable question items for exams.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={
            <Button className="gradient-brand text-white border-0 hover:opacity-90 h-9 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Question
            </Button>
          } />
          <DialogContent className="bg-background border-border text-foreground max-w-2xl sm:max-w-2xl p-6 max-h-[90vh] overflow-y-auto rounded-lg shadow-lg [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">Add question</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="coding" className="mt-4">
              <TabsList className="grid w-full grid-cols-2 h-11 bg-[#f4f4f5] dark:bg-zinc-800/50 p-1 mb-6 rounded-lg">
                <TabsTrigger 
                  value="coding" 
                  className="py-2 text-sm font-medium rounded-md data-active:bg-background data-active:text-foreground data-active:shadow-sm transition-all"
                >
                  <Code className="w-4 h-4 mr-2"/> Coding Task
                </TabsTrigger>
                <TabsTrigger 
                  value="mcq" 
                  className="py-2 text-sm font-medium rounded-md data-active:bg-background data-active:text-foreground data-active:shadow-sm transition-all"
                >
                  <List className="w-4 h-4 mr-2"/> MCQ Question
                </TabsTrigger>
              </TabsList>

              {/* Coding Tab */}
              <TabsContent value="coding" className="space-y-4 pt-1">
                <form onSubmit={handleSaveCoding} className="space-y-4">
                  <div className="h-[365px] overflow-y-auto pr-2 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="coding-tags" className="text-xs font-medium text-muted-foreground">Tags (comma-separated)</Label>
                        <Input id="coding-tags" placeholder="Arrays, DP, Recursion" value={tagsStr} onChange={e => setTagsStr(e.target.value)} className="mt-1.5 h-9" />
                      </div>
                      <div>
                        <Label htmlFor="coding-diff" className="text-xs font-medium text-muted-foreground">Difficulty</Label>
                        <Input id="coding-diff" placeholder="Easy/Medium/Hard" value={difficulty} onChange={e => setDifficulty(e.target.value)} className="mt-1.5 h-9" />
                      </div>
                      <div>
                        <Label htmlFor="coding-marks" className="text-xs font-medium text-muted-foreground">Marks</Label>
                        <Input id="coding-marks" required type="number" placeholder="10" value={marks} onChange={e => setMarks(e.target.value)} className="mt-1.5 h-9" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="coding-prob" className="text-xs font-medium text-muted-foreground">Problem Statement</Label>
                      <textarea id="coding-prob" required className="mt-1.5 w-full h-24 bg-background border border-input rounded-lg p-2.5 text-foreground text-sm focus:outline-none focus:border-ring resize-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" value={problemStatement} onChange={e => setProblemStatement(e.target.value)} placeholder="Describe the programming problem..."></textarea>
                    </div>
                    <div>
                      <Label htmlFor="coding-const" className="text-xs font-medium text-muted-foreground">Constraints</Label>
                      <Input id="coding-const" placeholder="1 <= N <= 10^5" value={constraints} onChange={e => setConstraints(e.target.value)} className="mt-1.5 h-9" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="coding-in" className="text-xs font-medium text-muted-foreground">Sample Input</Label>
                        <textarea id="coding-in" required className="mt-1.5 w-full h-20 bg-background border border-input rounded-lg p-2.5 text-foreground text-sm focus:outline-none focus:border-ring resize-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" value={sampleInput} onChange={e => setSampleInput(e.target.value)} placeholder="stdin input"></textarea>
                      </div>
                      <div>
                        <Label htmlFor="coding-out" className="text-xs font-medium text-muted-foreground">Sample Output</Label>
                        <textarea id="coding-out" required className="mt-1.5 w-full h-20 bg-background border border-input rounded-lg p-2.5 text-foreground text-sm focus:outline-none focus:border-ring resize-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" value={sampleOutput} onChange={e => setSampleOutput(e.target.value)} placeholder="expected stdout"></textarea>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0 pt-4 flex flex-row justify-end gap-2">
                    <Button 
                      variant="secondary" 
                      type="button" 
                      onClick={() => setIsDialogOpen(false)}
                      className="bg-[#f4f4f5] hover:bg-[#e4e4e7] text-zinc-900 border-0 h-9 px-4 rounded-md font-medium cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting} 
                      className="gradient-brand text-white border-0 hover:opacity-90 h-9 px-4 rounded-md font-medium cursor-pointer"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                      Save Coding Question
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>

              {/* MCQ Tab */}
              <TabsContent value="mcq" className="space-y-4 pt-1">
                <form onSubmit={handleSaveMCQ} className="space-y-4">
                  <div className="h-[365px] overflow-y-auto pr-2 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="mcq-tags" className="text-xs font-medium text-muted-foreground">Tags (comma-separated)</Label>
                        <Input id="mcq-tags" placeholder="OOP, Databases" value={tagsStr} onChange={e => setTagsStr(e.target.value)} className="mt-1.5 h-9" />
                      </div>
                      <div>
                        <Label htmlFor="mcq-diff" className="text-xs font-medium text-muted-foreground">Difficulty</Label>
                        <Input id="mcq-diff" placeholder="Easy/Medium/Hard" value={difficulty} onChange={e => setDifficulty(e.target.value)} className="mt-1.5 h-9" />
                      </div>
                      <div>
                        <Label htmlFor="mcq-marks" className="text-xs font-medium text-muted-foreground">Marks</Label>
                        <Input id="mcq-marks" required type="number" placeholder="2" value={marks} onChange={e => setMarks(e.target.value)} className="mt-1.5 h-9" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="mcq-text" className="text-xs font-medium text-muted-foreground">Question Text</Label>
                      <Input id="mcq-text" required placeholder="What does HTML stand for?" value={mcqText} onChange={e => setMcqText(e.target.value)} className="mt-1.5 h-9" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Options (Select radio for correct answer)</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-3">
                          <input type="radio" name="correct" checked={correctOption === 'A'} onChange={() => setCorrectOption('A')} className="accent-blue-500 cursor-pointer h-4 w-4 shrink-0" />
                          <Input required placeholder="Option A" value={optionA} onChange={e => setOptionA(e.target.value)} className="h-9" />
                        </div>
                        <div className="flex items-center space-x-3">
                          <input type="radio" name="correct" checked={correctOption === 'B'} onChange={() => setCorrectOption('B')} className="accent-blue-500 cursor-pointer h-4 w-4 shrink-0" />
                          <Input required placeholder="Option B" value={optionB} onChange={e => setOptionB(e.target.value)} className="h-9" />
                        </div>
                        <div className="flex items-center space-x-3">
                          <input type="radio" name="correct" checked={correctOption === 'C'} onChange={() => setCorrectOption('C')} className="accent-blue-500 cursor-pointer h-4 w-4 shrink-0" />
                          <Input placeholder="Option C (Optional)" value={optionC} onChange={e => setOptionC(e.target.value)} className="h-9" />
                        </div>
                        <div className="flex items-center space-x-3">
                          <input type="radio" name="correct" checked={correctOption === 'D'} onChange={() => setCorrectOption('D')} className="accent-blue-500 cursor-pointer h-4 w-4 shrink-0" />
                          <Input placeholder="Option D (Optional)" value={optionD} onChange={e => setOptionD(e.target.value)} className="h-9" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0 pt-4 flex flex-row justify-end gap-2">
                    <Button 
                      variant="secondary" 
                      type="button" 
                      onClick={() => setIsDialogOpen(false)}
                      className="bg-[#f4f4f5] hover:bg-[#e4e4e7] text-zinc-900 border-0 h-9 px-4 rounded-md font-medium cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting} 
                      className="gradient-brand text-white border-0 hover:opacity-90 h-9 px-4 rounded-md font-medium cursor-pointer"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                      Save MCQ Question
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mr-3" />
          Loading question bank...
        </div>
      ) : (
        <Tabs defaultValue="mcq" className="w-full">
          <TabsList className="bg-muted border border-border h-9 w-64 justify-start">
            <TabsTrigger value="mcq" className="text-xs font-semibold data-active:bg-background">MCQ ({mcqs.length})</TabsTrigger>
            <TabsTrigger value="coding" className="text-xs font-semibold data-active:bg-background">Coding ({codings.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="mcq" className="mt-4">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Question Text</th>
                    <th className="px-5 py-3 text-left font-semibold">Difficulty</th>
                    <th className="px-5 py-3 text-left font-semibold">Tags</th>
                    <th className="px-5 py-3 text-left font-semibold font-mono">Marks</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {mcqs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        No MCQ questions configured.
                      </td>
                    </tr>
                  ) : (
                    mcqs.map((q) => (
                      <tr key={q.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-foreground max-w-sm truncate">{q.text}</td>
                        <td className="px-5 py-3.5">
                          <StatusBadge tone={q.difficulty === 'Easy' ? 'success' : q.difficulty === 'Medium' ? 'warning' : 'danger'}>
                            {q.difficulty}
                          </StatusBadge>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {q.tags?.map((t: string) => (
                              <StatusBadge key={t} tone="info" className="text-[10px] py-0 px-2">{t}</StatusBadge>
                            )) || <span className="text-muted-foreground text-xs">N/A</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-foreground font-semibold">{q.marks}</td>
                        <td className="px-5 py-3.5 text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(q.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="coding" className="mt-4">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Problem Statement</th>
                    <th className="px-5 py-3 text-left font-semibold">Difficulty</th>
                    <th className="px-5 py-3 text-left font-semibold">Tags</th>
                    <th className="px-5 py-3 text-left font-semibold font-mono">Marks</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {codings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        No Coding tasks configured.
                      </td>
                    </tr>
                  ) : (
                    codings.map((q) => {
                      const tone = q.difficulty === "Easy" ? "success" : q.difficulty === "Medium" ? "warning" : "danger";
                      return (
                        <tr key={q.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-foreground max-w-sm truncate">
                            {q.codingQuestion?.problemStatement || 'Coding Task Details'}
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge tone={tone}>
                              {q.difficulty}
                            </StatusBadge>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex flex-wrap gap-1">
                              {q.tags?.map((t: string) => (
                                <StatusBadge key={t} tone="info" className="text-[10px] py-0 px-2">{t}</StatusBadge>
                              )) || <span className="text-muted-foreground text-xs">N/A</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-foreground font-semibold">{q.marks}</td>
                          <td className="px-5 py-3.5 text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(q.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
