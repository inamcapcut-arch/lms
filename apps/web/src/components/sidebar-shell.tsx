'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import Cookies from "js-cookie";
import {
  Bell, Search, ChevronsLeft, ChevronsRight, LogOut, ChevronDown, Menu
} from "lucide-react";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";

export type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

export function SidebarShell({
  items,
  greeting,
  children,
  searchPlaceholder = "Search",
}: {
  items: NavItem[];
  greeting?: string;
  children: ReactNode;
  searchPlaceholder?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const role = Cookies.get('role') || 'STUDENT';
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await apiClient('/api/v1/auth/me');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error('Failed to load profile in sidebar:', err);
      }
    }
    loadProfile();
  }, []);

  const displayName = profile?.name || (role === 'ADMIN' ? 'Admin User' : 'Student Scholar');
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (role === 'ADMIN' ? 'AD' : 'SS');

  const handleLogout = async () => {
    try {
      await apiClient('/api/v1/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed on backend:', err);
    }
    Cookies.remove('accessToken');
    Cookies.remove('role');
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground transition-colors duration-300">
      {/* Sidebar for Desktop */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar border-border transition-all duration-300 md:flex z-40",
          collapsed ? "w-[68px]" : "w-60"
        )}
      >
        <div className={cn("flex h-16 items-center border-b border-border px-4", collapsed && "justify-center px-2")}>
          {collapsed ? (
            <div className="grid h-8 w-8 place-items-center rounded-lg gradient-brand">
              <span className="text-xs font-bold text-white">A</span>
            </div>
          ) : (
            <Logo />
          )}
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((it) => {
            const active = it.to === '/admin' || it.to === '/student'
              ? pathname === it.to
              : pathname === it.to || pathname.startsWith(it.to + "/");
            return (
              <Link
                key={it.to}
                href={it.to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full gradient-brand" />}
                <it.icon className={cn("h-4 w-4 shrink-0", active && "text-[#3B82F6]")} />
                {!collapsed && <span className="truncate">{it.label}</span>}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="m-3 flex items-center justify-center gap-2 rounded-md border border-border py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <><ChevronsLeft className="h-3.5 w-3.5" /> Collapse</>}
        </button>
      </aside>

      {/* Mobile Sidebar overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="w-64 h-full bg-sidebar border-r border-border p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 items-center justify-between border-b border-border mb-4">
              <Logo />
            </div>
            <nav className="flex-1 space-y-1">
              {items.map((it) => {
                const active = it.to === '/admin' || it.to === '/student'
                  ? pathname === it.to
                  : pathname === it.to || pathname.startsWith(it.to + "/");
                return (
                  <Link
                    key={it.to}
                    href={it.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full gradient-brand" />}
                    <it.icon className={cn("h-4 w-4 shrink-0", active && "text-[#3B82F6]")} />
                    <span className="truncate">{it.label}</span>
                  </Link>
                );
              })}
            </nav>
            <button
              onClick={handleLogout}
              className="mt-auto flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[#EF4444] hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <button 
            onClick={() => setMobileOpen(true)}
            className="md:hidden grid h-9 w-9 place-items-center rounded-md border border-border hover:bg-accent text-foreground"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="min-w-0">
            {greeting && <div className="truncate text-sm font-semibold gradient-text">{greeting}</div>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={searchPlaceholder} className="h-9 w-64 pl-8 border-border" />
            </div>
            <button className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-accent text-muted-foreground transition-colors" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
            </button>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-accent transition-colors">
                  <div className="grid h-7 w-7 place-items-center rounded-full gradient-brand text-[10px] font-semibold text-white">{initials}</div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              } />
              <DropdownMenuContent align="end" className="w-44 border-border bg-popover text-popover-foreground">
                <DropdownMenuItem onClick={() => router.push(role === 'ADMIN' ? '/admin/settings' : '/student/settings')}>Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(role === 'ADMIN' ? '/admin/settings' : '/student/settings')}>Settings</DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={handleLogout} className="text-[#EF4444] focus:text-[#EF4444] focus:bg-red-500/10">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
