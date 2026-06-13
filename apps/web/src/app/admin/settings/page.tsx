'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Platform settings successfully updated!");
    }, 800);
  };

  return (
    <form onSubmit={handleSave} className="max-w-3xl space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">Configure global LMS rules, exam defaults, and integrations.</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-semibold text-foreground">Organization Profile</h2>
        <p className="text-xs text-muted-foreground">Public details about your testing workspace.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="org-name" className="text-xs">Workspace name</Label>
            <Input id="org-name" className="border-border bg-background" defaultValue="Acme Engineering Academy" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-sub" className="text-xs">Subdomain URL</Label>
            <Input id="org-sub" className="border-border bg-background" defaultValue="acme.assesscode.app" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-semibold text-foreground">Exam Administration Defaults</h2>
        <p className="text-xs text-muted-foreground">Defaults applied automatically when scheduling new exams.</p>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Auto-submit when time expires</div>
              <div className="text-xs text-muted-foreground">Automatically close attempts and execute grading.</div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Strict tab switching detection</div>
              <div className="text-xs text-muted-foreground">Warn candidates when they switch screens and report count.</div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Allow copy-pasting in Monaco editor</div>
              <div className="text-xs text-muted-foreground">Disable to minimize plagiarism risk.</div>
            </div>
            <Switch />
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" className="border-border hover:bg-accent text-foreground">Discard</Button>
        <Button type="submit" disabled={loading} className="gradient-brand text-white border-0 hover:opacity-90 font-semibold px-4 h-9">
          {loading ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
