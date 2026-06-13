'use client';

import { useState } from "react";
import { Plus, MoreHorizontal, Mail, Shield, UserX, UserCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";

const mockTrainers = [
  { id: "TR-01", name: "Dr. Sarah Jenkins", email: "sarah.j@assesscode.app", department: "Computer Science", activeExams: 3, status: "Active" },
  { id: "TR-02", name: "Prof. Alan Turing", email: "alan.turing@assesscode.app", department: "Mathematics", activeExams: 1, status: "Active" },
  { id: "TR-03", name: "Grace Hopper", email: "grace.h@assesscode.app", department: "Information Tech", activeExams: 0, status: "Inactive" },
  { id: "TR-04", name: "Ada Lovelace", email: "ada.l@assesscode.app", department: "Computer Science", activeExams: 5, status: "Active" },
];

export default function AdminTrainersPage() {
  const [trainers, setTrainers] = useState(mockTrainers);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState("");

  const handleAddTrainer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !dept) {
      toast.error("Please fill in all fields.");
      return;
    }
    const newTrainer = {
      id: `TR-${Math.floor(10 + Math.random() * 90)}`,
      name,
      email,
      department: dept,
      activeExams: 0,
      status: "Active"
    };
    setTrainers([newTrainer, ...trainers]);
    toast.success("Trainer invited successfully!");
    setOpen(false);
    setName("");
    setEmail("");
    setDept("");
  };

  const toggleStatus = (id: string) => {
    setTrainers(trainers.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === "Active" ? "Inactive" : "Active";
        toast.info(`Status updated for ${t.name}`);
        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  const deleteTrainer = (id: string) => {
    if (!confirm("Are you sure you want to delete this trainer's access?")) return;
    setTrainers(trainers.filter(t => t.id !== id));
    toast.success("Trainer access revoked.");
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trainer Management</h1>
          <p className="text-sm text-muted-foreground">Invite and manage trainers who set exams and review grading logs.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={
            <Button className="gradient-brand text-white border-0 hover:opacity-90 h-9 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Invite Trainer
            </Button>
          } />
          <DialogContent className="bg-popover border-border text-popover-foreground max-w-md">
            <DialogHeader>
              <DialogTitle>Invite New Trainer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddTrainer} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="trainer-name">Full Name</Label>
                <Input id="trainer-name" required placeholder="e.g. Dr. Sarah Jenkins" value={name} onChange={e => setName(e.target.value)} className="border-border bg-background" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trainer-email">Email Address</Label>
                <Input id="trainer-email" type="email" required placeholder="sarah.j@assesscode.app" value={email} onChange={e => setEmail(e.target.value)} className="border-border bg-background" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trainer-dept">Department</Label>
                <Input id="trainer-dept" required placeholder="e.g. Computer Science" value={dept} onChange={e => setDept(e.target.value)} className="border-border bg-background" />
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-10 mt-2"
                >
                  Send Invitation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border">
            <tr>
              <th className="px-5 py-3.5 text-left font-semibold">Trainer</th>
              <th className="px-5 py-3.5 text-left font-semibold">Department</th>
              <th className="px-5 py-3.5 text-left font-semibold">Active Exams</th>
              <th className="px-5 py-3.5 text-left font-semibold">Status</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {trainers.map((t) => {
              const isActive = t.status === "Active";
              const tone = isActive ? "success" : "neutral";
              const initials = t.name.split(" ").map(n => n[0]).join("");

              return (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-muted border border-border text-[10px] font-bold text-foreground shrink-0">
                        {initials}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground font-medium">{t.department}</td>
                  <td className="px-5 py-4 text-muted-foreground font-semibold font-mono">{t.activeExams} exams</td>
                  <td className="px-5 py-4">
                    <StatusBadge tone={tone} dot={isActive}>
                      {t.status}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <button className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      } />
                      <DropdownMenuContent align="end" className="border-border bg-popover text-popover-foreground">
                        <DropdownMenuItem className="cursor-pointer">
                          <Mail className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Email trainer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStatus(t.id)} className="cursor-pointer">
                          {isActive ? (
                            <>
                              <UserX className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Deactivate Account
                            </>
                          ) : (
                            <>
                              <UserCheck className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Activate Account
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteTrainer(t.id)} className="text-[#EF4444] focus:text-[#EF4444] focus:bg-red-500/10 cursor-pointer">
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Revoke Invitation
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
