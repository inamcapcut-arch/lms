'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Upload, Trash2, KeyRound, Search, MoreHorizontal, AlertCircle, Loader2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { StatusBadge } from '@/components/status-badge';

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  // Add Dialog fields state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [batch, setBatch] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [department, setDepartment] = useState('');

  // Edit Dialog fields state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBatch, setEditBatch] = useState('');
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');
  const [editPassword, setEditPassword] = useState('');

  const loadStudents = async () => {
    setLoading(true);
    try {
      const res = await apiClient('/api/v1/admin/students?page=1&limit=100');
      if (res.ok) {
        const data = await res.json();
        setStudents(data.data || []);
      } else {
        toast.error('Failed to load students');
      }
    } catch (err) {
      console.error('Error loading students:', err);
      toast.error('Error connecting to the server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.success(`Uploading ${file.name}...`);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await apiClient('/api/v1/admin/students/bulk-upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          toast.success(`CSV uploaded! Success: ${data.successCount}, Errors: ${data.failureCount}`);
          loadStudents();
        } else {
          const errData = await res.json();
          toast.error(errData.message || 'Bulk upload failed');
        }
      } catch (err) {
        toast.error('Upload connection error');
      }
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await apiClient('/api/v1/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          password,
          batch,
          registrationNumber: registrationNumber || undefined,
          department: department || undefined,
        }),
      });

      if (res.ok) {
        toast.success('Student added successfully');
        setIsDialogOpen(false);
        setEmail('');
        setName('');
        setPassword('');
        setBatch('');
        setRegistrationNumber('');
        setDepartment('');
        loadStudents();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to add student');
      }
    } catch (err) {
      toast.error('Server connection error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this student user account? This cannot be undone.')) {
      return;
    }

    try {
      const res = await apiClient(`/api/v1/admin/students/${userId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Student deleted successfully');
        loadStudents();
      } else {
        toast.error('Failed to delete student');
      }
    } catch (err) {
      toast.error('Error connecting to the server');
    }
  };

  const handleStartEdit = (user: any) => {
    setEditingStudent(user);
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditBatch(user.student?.batch || '');
    setEditStatus(user.status || 'ACTIVE');
    setEditPassword('');
    setIsEditOpen(true);
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    const previousStudents = [...students];
    const updatedStudents = students.map(s => {
      if (s.id === editingStudent.id) {
        return {
          ...s,
          email: editEmail,
          name: editName,
          status: editStatus,
          student: {
            ...s.student,
            batch: editBatch,
          },
        };
      }
      return s;
    });
    setStudents(updatedStudents);

    try {
      const res = await apiClient(`/api/v1/admin/students/${editingStudent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          batch: editBatch,
          status: editStatus,
          password: editPassword || undefined,
        }),
      });

      if (res.ok) {
        toast.success('Student updated successfully');
        setIsEditOpen(false);
        loadStudents();
      } else {
        setStudents(previousStudents);
        const data = await res.json();
        toast.error(data.message || 'Failed to update student');
      }
    } catch (err) {
      setStudents(previousStudents);
      toast.error('Server connection error');
    }
  };

  // Get distinct batches dynamically for filters
  const batches = Array.from(new Set(students.map(s => s.student?.batch).filter(Boolean)));

  const filteredStudents = students.filter(s => {
    const studentInfo = s.student || {};
    
    // Search filter
    const emailMatch = s.email?.toLowerCase().includes(search.toLowerCase());
    const nameMatch = s.name?.toLowerCase().includes(search.toLowerCase());
    const regMatch = studentInfo.registrationNumber?.toLowerCase().includes(search.toLowerCase());
    const deptMatch = studentInfo.department?.toLowerCase().includes(search.toLowerCase());
    const matchSearch = emailMatch || nameMatch || regMatch || deptMatch;

    // Batch filter
    const matchBatch = selectedBatch === 'all' || studentInfo.batch === selectedBatch;

    // Status filter
    const matchStatus = selectedStatus === 'all' || s.status === selectedStatus;

    return matchSearch && matchBatch && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">Manage student roster, credentials, and details.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input 
              type="file" 
              accept=".csv" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              onChange={handleBulkUpload}
            />
            <Button variant="outline" className="h-9 text-xs border-border bg-card hover:bg-accent text-foreground">
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Bulk CSV
            </Button>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={
              <Button className="gradient-brand text-white border-0 hover:opacity-90 h-9 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Student
              </Button>
            } />
            <DialogContent className="bg-background border-border text-foreground max-w-lg sm:max-w-lg p-6 rounded-lg shadow-lg [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">Add student</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateStudent} className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="create-name" className="text-xs font-medium text-muted-foreground">Full Name</Label>
                    <Input 
                      id="create-name"
                      required 
                      placeholder="John Doe" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1.5 h-9" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-email" className="text-xs font-medium text-muted-foreground">Email Address</Label>
                    <Input 
                      id="create-email"
                      required 
                      type="email" 
                      placeholder="student@example.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5 h-9" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="create-password" className="text-xs font-medium text-muted-foreground">Password</Label>
                    <Input 
                      id="create-password"
                      required 
                      type="password"
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1.5 h-9" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-batch" className="text-xs font-medium text-muted-foreground">Batch Year</Label>
                    <Input 
                      id="create-batch"
                      required 
                      placeholder="2026" 
                      value={batch}
                      onChange={(e) => setBatch(e.target.value)}
                      className="mt-1.5 h-9" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="create-reg" className="text-xs font-medium text-muted-foreground">Registration Number (Optional)</Label>
                    <Input 
                      id="create-reg"
                      placeholder="REG1000" 
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      className="mt-1.5 h-9" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="create-dept" className="text-xs font-medium text-muted-foreground">Department (Optional)</Label>
                    <Input 
                      id="create-dept"
                      placeholder="CSE" 
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="mt-1.5 h-9" 
                    />
                  </div>
                </div>
                <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0 pt-4 flex flex-row justify-end gap-2">
                  <Button 
                    variant="secondary" 
                    type="button" 
                    onClick={() => setIsDialogOpen(false)}
                    className="bg-[#f4f4f5] hover:bg-[#e4e4e7] text-zinc-900 border-0 h-9 px-4 rounded-md font-medium cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="gradient-brand text-white border-0 hover:opacity-90 h-9 px-4 rounded-md font-medium cursor-pointer"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</>
                    ) : (
                      'Save student'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Roster Filters Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search by name, email, registration number, department..." 
            className="h-9 pl-8 border-border" 
          />
        </div>
        
        <Select value={selectedBatch} onValueChange={(val) => setSelectedBatch(val || 'all')}>
          <SelectTrigger className="h-9 w-44 border-border bg-card"><SelectValue placeholder="Batch" /></SelectTrigger>
          <SelectContent className="border-border bg-popover text-popover-foreground">
            <SelectItem value="all">All Batches</SelectItem>
            {batches.map((b: any) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={(val) => setSelectedStatus(val || 'all')}>
          <SelectTrigger className="h-9 w-36 border-border bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="border-border bg-popover text-popover-foreground">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mr-3" />
          Loading student registry roster...
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Student Account</th>
                <th className="px-5 py-3.5 text-left font-semibold">Registration No</th>
                <th className="px-5 py-3.5 text-left font-semibold">Batch</th>
                <th className="px-5 py-3.5 text-left font-semibold">Department</th>
                <th className="px-5 py-3.5 text-left font-semibold">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center h-32 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    No students matching queries found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((user) => {
                  const studentInfo = user.student || {};
                  const isSuspended = user.status === 'SUSPENDED';
                  const tone = isSuspended ? "danger" : "success";
                  const statusLabel = isSuspended ? "Suspended" : "Active";
                  const initialsName = user.name || user.email;
                  const nameInitials = initialsName ? initialsName.slice(0, 2).toUpperCase() : 'ST';
                  
                  return (
                    <tr key={user.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-full gradient-brand text-[10px] font-bold text-white shrink-0">
                            {nameInitials}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{user.name || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-foreground font-semibold">
                        {studentInfo.registrationNumber || 'N/A'}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground font-medium">{studentInfo.batch || 'N/A'}</td>
                      <td className="px-5 py-3.5 text-muted-foreground font-medium">{studentInfo.department || 'N/A'}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge tone={tone} dot={!isSuspended}>
                          {statusLabel}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <button className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent text-muted-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          } />
                          <DropdownMenuContent align="end" className="border-border bg-popover text-popover-foreground">
                            <DropdownMenuItem onClick={() => handleStartEdit(user)} className="cursor-pointer">
                              <Edit className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Edit Student
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteStudent(user.id)} className="text-[#EF4444] focus:text-[#EF4444] focus:bg-red-500/10 cursor-pointer">
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Account
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Student Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-background border-border text-foreground max-w-lg sm:max-w-lg p-6 rounded-lg shadow-lg [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">Edit Student</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditStudent} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name" className="text-xs font-medium text-muted-foreground">Full Name</Label>
                <Input 
                  id="edit-name"
                  required 
                  placeholder="John Doe" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1.5 h-9" 
                />
              </div>
              <div>
                <Label htmlFor="edit-email" className="text-xs font-medium text-muted-foreground">Email Address</Label>
                <Input 
                  id="edit-email"
                  required 
                  type="email" 
                  placeholder="student@example.com" 
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1.5 h-9" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-batch" className="text-xs font-medium text-muted-foreground">Batch Year</Label>
                <Input 
                  id="edit-batch"
                  required 
                  placeholder="2026" 
                  value={editBatch}
                  onChange={(e) => setEditBatch(e.target.value)}
                  className="mt-1.5 h-9" 
                />
              </div>
              <div>
                <Label htmlFor="edit-status" className="text-xs font-medium text-muted-foreground">Status</Label>
                <Select value={editStatus} onValueChange={(val) => setEditStatus(val || 'ACTIVE')}>
                  <SelectTrigger className="mt-1.5 h-9 w-full bg-background border-input">
                    <SelectValue placeholder="Choose Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-password" className="text-xs font-medium text-muted-foreground">Password (Leave blank to keep unchanged)</Label>
              <Input 
                id="edit-password"
                type="password" 
                placeholder="New Password" 
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="mt-1.5 h-9" 
              />
            </div>
            <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0 pt-4 flex flex-row justify-end gap-2">
              <Button 
                variant="secondary" 
                type="button" 
                onClick={() => setIsEditOpen(false)}
                className="bg-[#f4f4f5] hover:bg-[#e4e4e7] text-zinc-900 border-0 h-9 px-4 rounded-md font-medium cursor-pointer"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="gradient-brand text-white border-0 hover:opacity-90 h-9 px-4 rounded-md font-medium cursor-pointer"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
