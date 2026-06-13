'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Clock, CheckCircle2, TrendingUp, Play, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';
import { AnimatedCounter } from '@/components/animated-counter';

export default function StudentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [assignmentsRes, resultsRes] = await Promise.all([
          apiClient('/api/v1/student/attempts/assignments'),
          apiClient('/api/v1/student/attempts/results'),
        ]);

        if (assignmentsRes.ok && resultsRes.ok) {
          const assignmentsData = await assignmentsRes.json();
          const resultsData = await resultsRes.json();
          setAssignments(assignmentsData);
          setResults(resultsData);
        } else {
          toast.error('Failed to load dashboard data');
        }
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        toast.error('Failed to connect to the server');
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Filter pending exams (status is IN_PROGRESS, AVAILABLE, or UPCOMING)
  const pendingExams = assignments.filter(a => a.status !== 'COMPLETED' && a.status !== 'EXPIRED');
  const upcomingCount = assignments.filter(a => a.status === 'UPCOMING').length;
  const completedCount = results.length;
  
  // Calculate average score dynamically
  let avgPercentage = 0;
  if (completedCount > 0) {
    const totalPercentage = results.reduce((acc, curr) => {
      const pct = curr.maxScore > 0 ? (curr.score / curr.maxScore) * 100 : 0;
      return acc + pct;
    }, 0);
    avgPercentage = Math.round(totalPercentage / completedCount);
  }

  const stats = [
    { label: "Assigned assessments", value: assignments.length, icon: FileText, trend: "Total roster", tone: "text-[#3B82F6]" },
    { label: "Upcoming / Available", value: pendingExams.length, icon: Clock, trend: `${upcomingCount} scheduled`, tone: "text-[#F59E0B]" },
    { label: "Completed exams", value: completedCount, icon: CheckCircle2, trend: "Graded & submitted", tone: "text-[#22C55E]" },
    { label: "Average score", value: `${avgPercentage}%`, icon: TrendingUp, trend: completedCount > 0 ? "Based on results" : "No results yet", tone: "text-[#22C55E]" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your Dashboard</h1>
        <p className="text-sm text-muted-foreground">Here's what's happening with your assessments.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</div>
              <s.icon className={`h-4 w-4 ${s.tone}`} />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">
              {(() => {
                const isPct = typeof s.value === 'string' && s.value.endsWith('%');
                const numericValue = typeof s.value === 'number' ? s.value : parseFloat(s.value);
                if (!isNaN(numericValue)) {
                  return <AnimatedCounter value={numericValue} suffix={isPct ? '%' : ''} />;
                }
                return s.value;
              })()}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{s.trend}</div>
          </motion.div>
        ))}
      </div>

      {/* Pending / Active Assessments Table */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Assigned Assessments</h2>
            <p className="text-xs text-muted-foreground">Assessments currently active or upcoming for you.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/student/exams')} className="text-muted-foreground text-xs hover:text-foreground">
            View all <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr className="border-b border-border">
                <th className="px-5 py-3.5 text-left font-semibold">Assessment</th>
                <th className="px-5 py-3.5 text-left font-semibold">Questions</th>
                <th className="px-5 py-3.5 text-left font-semibold">Timeline</th>
                <th className="px-5 py-3.5 text-left font-semibold">Duration</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {pendingExams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    No pending assessments found. You are all caught up!
                  </td>
                </tr>
              ) : (
                pendingExams.map((exam) => (
                  <tr key={exam.id} className="border-b border-border last:border-0 transition-colors hover:bg-accent/40">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-foreground">{exam.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{exam.description || 'No description provided.'}</div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{exam.questionCount} Qs</td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs">
                      End: {new Date(exam.endTime).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{exam.durationMinutes} mins</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge 
                        tone={exam.status === 'AVAILABLE' ? 'info' : exam.status === 'IN_PROGRESS' ? 'warning' : 'neutral'} 
                        dot={exam.status === 'IN_PROGRESS'}
                      >
                        {exam.status === 'IN_PROGRESS' ? 'In Progress' : exam.status === 'AVAILABLE' ? 'Available' : 'Upcoming'}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button 
                        size="sm" 
                        className={`gradient-brand text-white border-0 hover:opacity-90 ${
                          exam.status !== 'AVAILABLE' && exam.status !== 'IN_PROGRESS' ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        disabled={exam.status !== 'AVAILABLE' && exam.status !== 'IN_PROGRESS'}
                        onClick={() => router.push(`/student/exam/${exam.id}`)}
                      >
                        <Play className="mr-1 h-3.5 w-3.5 fill-current" /> 
                        {exam.status === 'IN_PROGRESS' ? 'Resume' : 'Start'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Completed Assessments list */}
      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Completed Assessments</h2>
          <p className="text-xs text-muted-foreground">Your most recent grades and performance indicators.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40">
              <tr className="border-b border-border">
                <th className="px-5 py-3.5 text-left font-semibold">Assessment</th>
                <th className="px-5 py-3.5 text-left font-semibold">Date Submitted</th>
                <th className="px-5 py-3.5 text-left font-semibold">Score Achieved</th>
                <th className="px-5 py-3.5 text-left font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">
                    No completed assessments found yet.
                  </td>
                </tr>
              ) : (
                results.map((res) => {
                  const percentage = res.maxScore > 0 ? Math.round((res.score / res.maxScore) * 100) : 0;
                  return (
                    <tr key={res.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-foreground">{res.title}</td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">
                        {new Date(res.completedAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold">{res.score}/{res.maxScore}</span>
                          <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted md:block">
                            <div 
                              className={`h-full ${res.passed ? 'bg-success' : 'bg-destructive'}`} 
                              style={{ width: `${percentage}%` }} 
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge tone={res.passed ? "success" : "danger"}>
                          {res.passed ? "Pass" : "Fail"}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
