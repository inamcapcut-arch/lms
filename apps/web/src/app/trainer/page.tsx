'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { AnimatedCounter } from '@/components/animated-counter';

export default function TrainerDashboard() {
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState({
    activeExams: 0,
    completedExams: 0,
    totalStudents: 0,
  });

  const loadStats = async () => {
    try {
      const res = await apiClient('/api/v1/admin/exams/stats');
      if (res.ok) {
        const data = await res.json();
        setStatsData(data);
      } else {
        toast.error('Failed to load dashboard statistics');
      }
    } catch (err) {
      toast.error('Error connecting to the server');
    }
  };

  useEffect(() => {
    async function initDashboard() {
      setLoading(true);
      await loadStats();
      setLoading(false);
    }
    initDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  const stats = [
    { label: "Active exams", value: statsData.activeExams, icon: FileText, color: "#6366F1", trend: "Published" },
    { label: "Completed exams", value: statsData.completedExams, icon: CheckCircle2, color: "#22C55E", trend: "Submitted" },
    { label: "Total students", value: statsData.totalStudents, icon: Users, color: "#3B82F6", trend: "Registered" },
  ];

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trainer Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage your exams and questions.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</div>
              <div className="grid h-7 w-7 place-items-center rounded-md" style={{ background: `${s.color}1a`, color: s.color }}>
                <s.icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">
              <AnimatedCounter value={s.value} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{s.trend}</div>
          </motion.div>
        ))}
      </div>
      
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle>Welcome to AssessCode Trainer Portal</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-4">
          <p>From this portal, you can author new coding challenges and multiple-choice questions in the Question Bank, and bundle them into Exams.</p>
          <p>Please note: All exams you create will start in a <strong>DRAFT</strong> status. An Administrator must review and approve them before they are published to students.</p>
        </CardContent>
      </Card>
    </div>
  );
}
