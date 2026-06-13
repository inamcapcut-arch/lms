'use client';

import { usePathname } from 'next/navigation';
import { BookOpen, LayoutDashboard, Settings, CheckCircle } from 'lucide-react';
import { SidebarShell } from "@/components/sidebar-shell";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Don't show sidebar inside the actual exam taking interface
  const isExamMode = pathname.includes('/student/exam/');

  if (isExamMode) {
    return <div className="min-h-screen w-full bg-background text-foreground">{children}</div>;
  }

  const navigation = [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/student/exams', label: 'My Exams', icon: BookOpen },
    { to: '/student/results', label: 'Results', icon: CheckCircle },
    { to: '/student/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <SidebarShell items={navigation} greeting="Student Portal" searchPlaceholder="Search exams…">
      {children}
    </SidebarShell>
  );
}
