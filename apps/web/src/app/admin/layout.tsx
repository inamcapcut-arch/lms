'use client';

import { 
  LayoutDashboard, Users, FileText, Database, Activity, Settings, UserCheck 
} from "lucide-react";
import { SidebarShell } from "@/components/sidebar-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigation = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/students', label: 'Students', icon: Users },
    { to: '/admin/exams', label: 'Exams', icon: FileText },
    { to: '/admin/questions', label: 'Question Bank', icon: Database },
    { to: '/admin/monitoring', label: 'Monitoring', icon: Activity },
    { to: '/admin/trainers', label: 'Trainers', icon: UserCheck },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <SidebarShell items={navigation} greeting="Admin Console" searchPlaceholder="Search students, exams…">
      {children}
    </SidebarShell>
  );
}
