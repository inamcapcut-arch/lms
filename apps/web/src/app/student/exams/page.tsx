'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Clock, AlertCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';

export default function StudentExamsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'COMPLETED'>('ALL');

  useEffect(() => {
    async function loadExams() {
      try {
        const res = await apiClient('/api/v1/student/attempts/assignments');
        if (res.ok) {
          const data = await res.json();
          setAssignments(data);
        } else {
          toast.error('Failed to load exams');
        }
      } catch (err) {
        console.error('Error loading student exams:', err);
        toast.error('Error connecting to the server');
      } finally {
        setLoading(false);
      }
    }
    loadExams();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading your assessments...</p>
        </div>
      </div>
    );
  }

  const filtered = assignments.filter((a) => {
    if (filter === 'ALL') return true;
    if (filter === 'COMPLETED') return a.status === 'COMPLETED';
    if (filter === 'ACTIVE') return a.status === 'AVAILABLE' || a.status === 'IN_PROGRESS';
    if (filter === 'UPCOMING') return a.status === 'UPCOMING';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Assessments</h1>
          <p className="text-sm text-muted-foreground">All coding and MCQ exams assigned to your account.</p>
        </div>
        
        {/* Filters */}
        <div className="flex bg-card p-1 rounded-lg border border-border space-x-1">
          {(['ALL', 'ACTIVE', 'UPCOMING', 'COMPLETED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              {f === 'ALL' ? 'All' : f === 'ACTIVE' ? 'Active' : f === 'UPCOMING' ? 'Upcoming' : 'Completed'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          <AlertCircle className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-foreground font-semibold mb-1">No assessments found</h3>
          <p className="text-xs max-w-xs mx-auto">
            There are no exams matching your filter right now. Check back later!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((exam, i) => {
            const isClickable = exam.status === 'AVAILABLE' || exam.status === 'IN_PROGRESS';
            const badgeTone = 
              exam.status === 'COMPLETED' ? 'success' : 
              exam.status === 'IN_PROGRESS' ? 'warning' : 
              exam.status === 'AVAILABLE' ? 'info' : 'neutral';
            const badgeLabel = 
              exam.status === 'COMPLETED' ? 'Completed' : 
              exam.status === 'IN_PROGRESS' ? 'In Progress' : 
              exam.status === 'AVAILABLE' ? 'Available' : 'Upcoming';

            return (
              <motion.div 
                key={exam.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs text-muted-foreground font-mono font-medium">ID: {exam.id.slice(0, 8)}</span>
                    <StatusBadge tone={badgeTone} dot={exam.status === 'IN_PROGRESS'}>{badgeLabel}</StatusBadge>
                  </div>
                  <h3 className="text-lg font-bold text-foreground line-clamp-1 mb-1">{exam.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4">
                    {exam.description || 'No description provided.'}
                  </p>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-border/60">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {exam.durationMinutes}m duration</span>
                    <span className="flex items-center"><BookOpen className="w-3.5 h-3.5 mr-1" /> {exam.questionCount} Questions</span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40">
                    <div className="flex justify-between">
                      <span>Window Start:</span>
                      <span className="font-semibold text-foreground/80">{new Date(exam.startTime).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Window End:</span>
                      <span className="font-semibold text-foreground/80">{new Date(exam.endTime).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <Button
                    className={`w-full text-xs h-9 font-semibold ${
                      isClickable
                        ? 'gradient-brand text-white border-0 hover:opacity-90'
                        : 'bg-muted text-muted-foreground cursor-not-allowed border border-border'
                    }`}
                    disabled={!isClickable}
                    onClick={() => router.push(`/student/exam/${exam.id}`)}
                  >
                    {exam.status === 'IN_PROGRESS' ? (
                      <>
                        <Play className="mr-1.5 h-3.5 w-3.5 fill-current" /> Resume Assessment
                      </>
                    ) : exam.status === 'AVAILABLE' ? (
                      <>
                        <Play className="mr-1.5 h-3.5 w-3.5 fill-current" /> Start Assessment
                      </>
                    ) : exam.status === 'COMPLETED' ? (
                      'Assessment Submitted'
                    ) : (
                      'Upcoming'
                    )}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
