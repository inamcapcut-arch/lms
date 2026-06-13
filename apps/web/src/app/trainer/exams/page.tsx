'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, MoreHorizontal, Calendar, Play, Square, Trash2, Clock, Users, BookOpen, Loader2, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { StatusBadge } from '@/components/status-badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function ExamsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  
  // Lists for selection
  const [questions, setQuestions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  
  // Controlled Select Batch State
  const [batchVal, setBatchVal] = useState('');
  const [batchSearch, setBatchSearch] = useState('');

  // Unique batches computed from students list
  const batches = Array.from(new Set(students.map(s => s.student?.batch).filter(Boolean)));

  const handleBatchSelect = (batchName: string | null) => {
    if (!batchName) return;
    if (batchName === 'all') {
      setSelectedStudents(students.map(s => s.student?.id).filter(Boolean));
    } else if (batchName === 'clear') {
      setSelectedStudents([]);
    } else {
      const batchStudentIds = students
        .filter(s => s.student?.batch === batchName)
        .map(s => s.student?.id)
        .filter(Boolean);
      setSelectedStudents(batchStudentIds);
    }
  };

  const loadExams = async () => {
    setLoading(true);
    try {
      const res = await apiClient('/api/v1/admin/exams');
      if (res.ok) {
        const data = await res.json();
        setExams(data);
      } else {
        toast.error('Failed to load exams');
      }
    } catch (err) {
      console.error('Error fetching exams:', err);
      toast.error('Error connecting to the server');
    } finally {
      setLoading(false);
    }
  };

  const loadSelectionData = async () => {
    try {
      const [questionsRes, studentsRes] = await Promise.all([
        apiClient('/api/v1/admin/questions'),
        apiClient('/api/v1/admin/students?page=1&limit=100'),
      ]);

      if (questionsRes.ok && studentsRes.ok) {
        const questionsData = await questionsRes.json();
        const studentsData = await studentsRes.json();
        setQuestions(questionsData);
        setStudents(studentsData.data || []);
      }
    } catch (err) {
      console.error('Error loading selection metadata:', err);
    }
  };

  useEffect(() => {
    loadExams();
    loadSelectionData();
  }, []);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedQuestions.length === 0) {
      toast.error('Please assign at least one question');
      return;
    }
    if (selectedStudents.length === 0) {
      toast.error('Please assign at least one student');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient('/api/v1/admin/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          durationMinutes: parseInt(durationMinutes, 10),
          questionIds: selectedQuestions,
          studentIds: selectedStudents,
        }),
      });

      if (res.ok) {
        toast.success('Exam created and scheduled successfully!');
        setIsDialogOpen(false);
        setTitle('');
        setDescription('');
        setStartTime('');
        setEndTime('');
        setDurationMinutes('');
        setSelectedQuestions([]);
        setSelectedStudents([]);
        setBatchVal('');
        setBatchSearch('');
        loadExams();
      } else {
        const errData = await res.json();
        toast.error(errData.message || 'Failed to create exam');
      }
    } catch (err) {
      toast.error('Connection error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exam? This will remove all associated submissions!')) return;
    try {
      const res = await apiClient(`/api/v1/admin/exams/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Exam deleted successfully');
        loadExams();
      } else {
        toast.error('Failed to delete exam');
      }
    } catch (err) {
      toast.error('Server connection error');
    }
  };

  const handleExportResults = async (id: string, examTitle: string) => {
    try {
      const res = await apiClient(`/api/v1/admin/exams/${id}/export`);
      if (res.ok) {
        const csvText = await res.text();
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `results_${examTitle.toLowerCase().replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Results exported successfully');
      } else {
        toast.error('Failed to export results');
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Connection error exporting results');
    }
  };

  const toggleQuestion = (id: string) => {
    setSelectedQuestions(prev =>
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Exam Configuration</h1>
          <p className="text-sm text-muted-foreground">Create, schedule, and assign assessment papers to student batches.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={
            <Button className="gradient-brand text-white border-0 hover:opacity-90 h-9 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Create Exam
            </Button>
          } />
          <DialogContent className="bg-background border-border text-foreground max-w-lg sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto rounded-lg shadow-lg [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">Create exam</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateExam} className="space-y-4 py-2">
              <div>
                <Label htmlFor="exam-title" className="text-xs font-medium text-muted-foreground">Exam name</Label>
                <Input 
                  id="exam-title"
                  required 
                  placeholder="e.g. Backend Engineering Round 1" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 h-9" 
                />
              </div>

              <div>
                <Label htmlFor="exam-desc" className="text-xs font-medium text-muted-foreground">Description</Label>
                <Input 
                  id="exam-desc"
                  required 
                  placeholder="Short description of topics covered" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1.5 h-9" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="exam-start" className="text-xs font-medium text-muted-foreground">Start Time</Label>
                  <Input 
                    id="exam-start"
                    required 
                    type="datetime-local" 
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1.5 h-9 text-xs" 
                  />
                </div>
                <div>
                  <Label htmlFor="exam-end" className="text-xs font-medium text-muted-foreground">End Time</Label>
                  <Input 
                    id="exam-end"
                    required 
                    type="datetime-local" 
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1.5 h-9 text-xs" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="exam-dur" className="text-xs font-medium text-muted-foreground">Duration (min)</Label>
                  <Input 
                    id="exam-dur"
                    required 
                    type="number" 
                    placeholder="90" 
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="mt-1.5 h-9" 
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Assign to Batch (Auto-Assign)</Label>
                  <Select value={batchVal} onValueChange={(val) => { setBatchVal(val || ''); handleBatchSelect(val); }}>
                    <SelectTrigger className="mt-1.5 h-9 w-full bg-background border-input">
                      <SelectValue placeholder="Choose batch..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-popover-foreground max-h-60 overflow-y-auto">
                      <div className="p-2 border-b border-border sticky top-0 bg-popover z-10">
                        <Input
                          placeholder="Search batch..."
                          value={batchSearch}
                          onChange={(e) => setBatchSearch(e.target.value)}
                          className="h-8 text-xs w-full bg-background border-border"
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      <SelectItem value="clear">Clear Selection</SelectItem>
                      <SelectItem value="all">All Students</SelectItem>
                      {batches
                        .filter((b: any) => b.toLowerCase().includes(batchSearch.toLowerCase()))
                        .map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Assign Questions */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Assign Questions ({selectedQuestions.length} selected)</Label>
                <div className="mt-1.5 border border-zinc-200 bg-background dark:border-zinc-800 rounded-lg p-3 max-h-32 overflow-y-auto space-y-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {questions.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No questions configured</div>
                  ) : (
                    questions.map(q => (
                      <label key={q.id} className="flex items-center text-xs space-x-2 text-foreground/80 cursor-pointer hover:text-foreground">
                        <input 
                          type="checkbox" 
                          checked={selectedQuestions.includes(q.id)}
                          onChange={() => toggleQuestion(q.id)}
                          className="rounded border-border text-[#3B82F6] focus:ring-0 cursor-pointer"
                        />
                        <span>[{q.type}] {q.type === 'CODING' ? q.codingQuestion?.problemStatement?.slice(0, 50) : q.text?.slice(0, 50)}... ({q.marks} marks)</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Assign Students */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Assign Students ({selectedStudents.length} selected)</Label>
                <div className="mt-1.5 border border-zinc-200 bg-background dark:border-zinc-800 rounded-lg p-3 max-h-32 overflow-y-auto space-y-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {students.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No students registered</div>
                  ) : (
                    students.map(s => {
                      const studentInfo = s.student || {};
                      return (
                        <label key={s.id} className="flex items-center text-xs space-x-2 text-foreground/80 cursor-pointer hover:text-foreground">
                          <input 
                            type="checkbox" 
                            checked={selectedStudents.includes(studentInfo.id)}
                            onChange={() => toggleStudent(studentInfo.id)}
                            className="rounded border-border text-[#3B82F6] focus:ring-0 cursor-pointer"
                          />
                          <span>{s.email} ({studentInfo.registrationNumber || 'N/A'}) - Batch {studentInfo.batch || 'N/A'}</span>
                        </label>
                      );
                    })
                  )}
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
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Creating exam…</>
                  ) : (
                    'Create exam'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mr-3" />
          Loading active exams...
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Exam Title</th>
                <th className="px-5 py-3.5 text-left font-semibold">Duration</th>
                <th className="px-5 py-3.5 text-left font-semibold">Questions</th>
                <th className="px-5 py-3.5 text-left font-semibold">Assigned Candidates</th>
                <th className="px-5 py-3.5 text-left font-semibold">Active Window</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {exams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    No assessments scheduled yet.
                  </td>
                </tr>
              ) : (
                exams.map((exam) => {
                  const now = new Date();
                  const start = new Date(exam.startTime);
                  const end = new Date(exam.endTime);
                  
                  let status = 'Scheduled';
                  let tone: 'success' | 'info' | 'neutral' = 'info';
                  if (now >= start && now <= end) {
                    status = 'Live';
                    tone = 'success';
                  } else if (now > end) {
                    status = 'Ended';
                    tone = 'neutral';
                  }

                  return (
                    <tr key={exam.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground">{exam.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{exam.description || 'No description.'}</div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground font-mono font-medium">
                        {exam.durationMinutes}m
                      </td>
                      <td className="px-5 py-4 text-muted-foreground font-medium">
                        {exam._count?.questions || 0} Qs
                      </td>
                      <td className="px-5 py-4 text-muted-foreground font-medium">
                        {exam._count?.assignments || 0} Students
                      </td>
                      <td className="px-5 py-4 text-muted-foreground text-xs">
                        <div>{start.toLocaleDateString()} {start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        <div className="text-[10px] text-muted-foreground/70">to {end.toLocaleDateString()} {end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge tone={tone} dot={status === 'Live'}>
                          {status}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <button className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent text-muted-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          } />
                          <DropdownMenuContent align="end" className="border-border bg-popover text-popover-foreground">
                            <DropdownMenuItem onClick={() => handleExportResults(exam.id, exam.title)} className="cursor-pointer">
                              <Download className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Export Results
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer">
                              <Calendar className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Adjust window
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer">
                              <Play className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Force start
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteExam(exam.id)}
                              className="text-[#EF4444] focus:text-[#EF4444] focus:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Exam
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
