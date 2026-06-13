'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function StudentSettingsPage() {
  const [loading, setLoading] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Account profile successfully updated!");
    }, 800);
  };

  return (
    <form onSubmit={handleSave} className="max-w-2xl space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your personal profile and account credentials.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 border-b border-border pb-6">
          <div className="grid h-16 w-16 place-items-center rounded-full gradient-brand text-lg font-bold text-white shadow-md">
            SS
          </div>
          <div>
            <div className="font-semibold text-foreground text-lg">Student Scholar</div>
            <div className="text-sm text-muted-foreground">REG001 · Computer Science (CSE)</div>
          </div>
          <Button variant="outline" size="sm" type="button" className="ml-auto text-xs border-border hover:bg-accent">
            Change avatar
          </Button>
        </div>

        <div className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fullname" className="text-xs">Full Name</Label>
            <Input id="fullname" className="border-border bg-background" defaultValue="Student Scholar" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email Address</Label>
            <Input id="email" className="border-border bg-background" defaultValue="student@assesscode.app" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="batch" className="text-xs">Academic Batch</Label>
            <Input id="batch" className="border-border bg-background" defaultValue="CSE-2026-A" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="regno" className="text-xs">Registration Number</Label>
            <Input id="regno" className="border-border bg-background" defaultValue="REG001" disabled />
          </div>
        </div>

        <div className="mt-6 border-t border-border/60 pt-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Change Password</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-pass" className="text-xs">New Password</Label>
              <Input id="new-pass" type="password" placeholder="••••••••" className="border-border bg-background" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pass" className="text-xs">Confirm Password</Label>
              <Input id="confirm-pass" type="password" placeholder="••••••••" className="border-border bg-background" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-border/40 pt-4">
          <Button variant="outline" type="button" className="border-border hover:bg-accent text-foreground text-xs h-9">Discard</Button>
          <Button type="submit" disabled={loading} className="gradient-brand text-white border-0 hover:opacity-90 font-semibold px-4 h-9 text-xs">
            {loading ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
