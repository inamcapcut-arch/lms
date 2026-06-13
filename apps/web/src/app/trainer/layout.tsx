'use client';

import { LayoutDashboard, FileText, Database } from "lucide-react";
import { SidebarShell } from "@/components/sidebar-shell";

export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigation = [
    { to: '/trainer', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/trainer/exams', label: 'My Exams', icon: FileText },
    { to: '/trainer/questions', label: 'Question Bank', icon: Database },
  ];

  return (
    <SidebarShell items={navigation} greeting="Trainer Portal" searchPlaceholder="Search exams, questions…">
      {children}
    </SidebarShell>
  );
}
