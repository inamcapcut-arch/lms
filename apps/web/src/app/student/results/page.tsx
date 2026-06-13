'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';

export default function StudentResultsPage() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    async function loadResults() {
      try {
        const res = await apiClient('/api/v1/student/attempts/results');
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        } else {
          toast.error('Failed to load results');
        }
      } catch (err) {
        console.error('Error loading results:', err);
        toast.error('Error connecting to the server');
      } finally {
        setLoading(false);
      }
    }
    loadResults();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading your grades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Results & Performance</h1>
        <p className="text-sm text-muted-foreground">Historical records of your scores and performance breakdown.</p>
      </div>

      {results.length === 0 ? (
        <Card className="border border-border bg-card p-12 text-center text-muted-foreground">
          <CardContent className="p-0">
            <AlertCircle className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-foreground font-semibold mb-1">No results available</h3>
            <p className="text-xs max-w-xs mx-auto">
              You haven't completed any assessments yet. Finished exams will display grades here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Assessment</th>
                <th className="px-5 py-3.5 text-left font-semibold">Date Completed</th>
                <th className="px-5 py-3.5 text-left font-semibold font-mono">Score / Grade</th>
                <th className="px-5 py-3.5 text-left font-semibold">Score Distribution</th>
                <th className="px-5 py-3.5 text-left font-semibold">Result Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((res) => {
                const percentage = res.maxScore > 0 ? Math.round((res.score / res.maxScore) * 100) : 0;
                return (
                  <tr key={res.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-foreground">{res.title}</div>
                      <div className="text-xs text-muted-foreground">Exam Attempt ID: {res.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground text-xs">
                      {new Date(res.completedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 font-mono font-semibold text-foreground">
                      {res.score} <span className="text-muted-foreground font-normal text-xs">/ {res.maxScore}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-xs text-blue-500 w-8">{percentage}%</span>
                        <div className="h-2 w-36 overflow-hidden rounded-full bg-muted border border-border/10 shrink-0">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              res.passed ? 'bg-success' : 'bg-destructive'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={res.passed ? "success" : "danger"}>
                        {res.passed ? "Passed" : "Failed"}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
