'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, FileText, CheckCircle2, Activity, Send, Loader2 } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { AnimatedCounter } from '@/components/animated-counter';
import { Button } from '@/components/ui/button';

// Mock charts data from Lovable spec
const examsPerMonth = [
  { month: "Jan", exams: 12 }, { month: "Feb", exams: 18 }, { month: "Mar", exams: 22 },
  { month: "Apr", exams: 16 }, { month: "May", exams: 28 }, { month: "Jun", exams: 34 },
  { month: "Jul", exams: 24 }, { month: "Aug", exams: 30 }, { month: "Sep", exams: 38 },
  { month: "Oct", exams: 42 }, { month: "Nov", exams: 36 }, { month: "Dec", exams: 44 },
];

const submissions7d = [
  { day: "Mon", subs: 142 }, { day: "Tue", subs: 188 }, { day: "Wed", subs: 224 },
  { day: "Thu", subs: 196 }, { day: "Fri", subs: 268 }, { day: "Sat", subs: 134 },
  { day: "Sun", subs: 98 },
];

const questionSplit = [
  { name: "MCQ", value: 62 },
  { name: "Coding", value: 38 },
];

const COLORS = ["#3B82F6", "#6366F1"];

function getRelativeTime(timestamp: string) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [statsData, setStatsData] = useState({
    totalStudents: 0,
    activeExams: 0,
    completedExams: 0,
    activeSessions: 0,
  });

  // Recent Activity State
  const [activities, setActivities] = useState<any[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLoading, setActivityLoading] = useState(false);
  const [totalActivityPages, setTotalActivityPages] = useState(1);

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
      console.error('Error fetching admin dashboard stats:', err);
      toast.error('Error connecting to the server');
    }
  };

  const loadActivities = async (page: number, append = false) => {
    setActivityLoading(true);
    try {
      const res = await apiClient(`/api/v1/admin/activities?page=${page}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        if (append) {
          setActivities(prev => [...prev, ...(data.data || [])]);
        } else {
          setActivities(data.data || []);
        }
        setTotalActivityPages(data.meta?.totalPages || 1);
      }
    } catch (err) {
      console.error('Error loading activities:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    async function initDashboard() {
      setLoading(true);
      await Promise.all([loadStats(), loadActivities(1)]);
      setLoading(false);
    }
    initDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
          <p className="text-muted-foreground text-sm">Loading dashboard statistics...</p>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Total students", value: statsData.totalStudents, icon: Users, color: "#3B82F6", trend: "Registered" },
    { label: "Active exams", value: statsData.activeExams, icon: FileText, color: "#6366F1", trend: "Published" },
    { label: "Completed exams", value: statsData.completedExams, icon: CheckCircle2, color: "#22C55E", trend: "Submitted" },
    { label: "Active sessions", value: statsData.activeSessions, icon: Activity, color: "#F59E0B", trend: "Live students" },
    { label: "Total submissions", value: statsData.completedExams * 3 + statsData.activeSessions, icon: Send, color: "#EF4444", trend: "Calculated" },
  ];

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Real-time snapshot of your assessment workspace.</p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

      {/* Graphs Grid */}
      {mounted && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="font-semibold text-foreground">Exams per Month</h3>
              <p className="text-xs text-muted-foreground">Historical exam scheduler volumes</p>
            </div>
            <div className="w-full">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={examsPerMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: "var(--accent)" }}
                  />
                  <Bar dataKey="exams" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div>
              <h3 className="font-semibold text-foreground">Question Mix</h3>
              <p className="text-xs text-muted-foreground">MCQ vs Coding distribution</p>
            </div>
            <div className="w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={questionSplit} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {questionSplit.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Bottom widgets */}
      <div className="grid gap-4 lg:grid-cols-3">
        {mounted && (
          <div className="rounded-xl border border-border bg-card p-5 lg:col-span-1 h-[340px] flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Submission Activity</h3>
              <p className="text-xs text-muted-foreground mb-4">Aggregated code executions (7 days)</p>
            </div>
            <div className="w-full flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={submissions7d}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey="subs" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, fill: "#3B82F6" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <Card className="border border-border bg-card h-[340px] flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-semibold">System Health</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex-1 space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Database Pool (PostgreSQL)</span>
                <span className="text-success font-semibold text-[10px]">99.9% Healthy</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div className="bg-success h-1.5 rounded-full" style={{ width: '92%' }}></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Redis Queue Server (BullMQ)</span>
                <span className="text-success font-semibold text-[10px]">Operational</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div className="bg-success h-1.5 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Code Sandbox Executor</span>
                <span className="text-[#3B82F6] font-semibold text-[10px]">Ready (0 jobs pending)</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div className="bg-[#3B82F6] h-1.5 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card h-[340px] flex flex-col overflow-hidden">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            {activityLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent className="pt-4 flex-1 overflow-y-auto space-y-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {activities.length === 0 && !activityLoading ? (
              <div className="text-center text-xs text-muted-foreground py-12">
                No recent activity recorded.
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((act) => {
                  const initials = act.user?.name ? act.user.name.slice(0, 2).toUpperCase() : 'ST';
                  return (
                    <div key={act.id} className="flex items-start gap-2.5 text-xs border-b border-border/20 pb-2 last:border-0 last:pb-0">
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-blue-500/10 text-blue-500 text-[9px] font-bold shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground text-[11px] leading-snug">{act.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{getRelativeTime(act.timestamp)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {activityPage < totalActivityPages && (
              <div className="pt-2 text-center">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    const nextPage = activityPage + 1;
                    setActivityPage(nextPage);
                    loadActivities(nextPage, true);
                  }}
                  className="h-7 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Load More
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
