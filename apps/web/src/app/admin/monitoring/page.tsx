'use client';

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

const monitoringFeed = [
  { id: "mon-0", name: "Sadiq Rahman", exam: "DSA Final", progress: 78, status: "online", elapsed: "20m" },
  { id: "mon-1", name: "Aanya Sharma", exam: "Algorithms Sprint", progress: 45, status: "online", elapsed: "23m" },
  { id: "mon-2", name: "Marcus Chen", exam: "SQL Proficiency", progress: 92, status: "online", elapsed: "26m" },
  { id: "mon-3", name: "Priya Iyer", exam: "Frontend", progress: 63, status: "online", elapsed: "29m" },
  { id: "mon-4", name: "Daniel Okafor", exam: "DSA Final", progress: 12, status: "away", elapsed: "32m" },
  { id: "mon-5", name: "Elena Volkov", exam: "Algorithms Sprint", progress: 88, status: "online", elapsed: "35m" },
  { id: "mon-6", name: "Yuki Tanaka", exam: "SQL Proficiency", progress: 50, status: "online", elapsed: "38m" },
  { id: "mon-7", name: "Olivia Martinez", exam: "Frontend", progress: 34, status: "online", elapsed: "41m" },
  { id: "mon-8", name: "Liam Park", exam: "DSA Final", progress: 70, status: "away", elapsed: "44m" },
  { id: "mon-9", name: "Zara Hussain", exam: "Algorithms Sprint", progress: 22, status: "online", elapsed: "47m" },
  { id: "mon-10", name: "Noah Kim", exam: "SQL Proficiency", progress: 95, status: "online", elapsed: "50m" },
  { id: "mon-11", name: "Mei Lin", exam: "Frontend", progress: 58, status: "online", elapsed: "53m" },
];

export default function AdminMonitoringPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const onlineCount = monitoringFeed.filter((s) => s.status === "online").length;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Monitoring</h1>
          <p className="text-sm text-muted-foreground">Students currently taking assessments on the platform.</p>
        </div>
        <StatusBadge tone="success" dot>{onlineCount} online</StatusBadge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {monitoringFeed.map((s, i) => (
          <motion.div 
            key={s.id}
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.3, delay: i * 0.03 }}
            className="rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="grid h-10 w-10 place-items-center rounded-full gradient-brand text-xs font-bold text-white shrink-0">
                  {s.name.split(" ").map((p) => p[0]).join("")}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${s.status === "online" ? "bg-[#22C55E]" : "bg-[#F59E0B]"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-foreground">{s.name}</div>
                <div className="truncate text-xs text-muted-foreground">{s.exam}</div>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold text-foreground">{s.progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted border border-border/10">
                <div className="h-full gradient-brand transition-all duration-500" style={{ width: `${s.progress}%` }} />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
                <span>Elapsed: {s.elapsed}</span>
                <span className="flex items-center text-[10px] text-blue-500 font-semibold gap-0.5">
                  <Activity className="h-3 w-3 animate-pulse" /> Live Feed
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
