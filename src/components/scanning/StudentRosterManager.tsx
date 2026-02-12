'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, UserPlus, Upload, Download, Trash2, Search } from 'lucide-react';
import { StudentRosterService } from '@/services/studentRosterService';

interface StudentRosterManagerProps {
  examId: string;
  userId: string;
}

export default function StudentRosterManager({ examId, userId }: StudentRosterManagerProps) {
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [newStudentId, setNewStudentId] = useState('');
  const [rosterId, setRosterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [validationStatus, setValidationStatus] = useState<Record<string, { exists: boolean; name?: string }>>({});

  useEffect(() => {
    loadRoster();
  }, [examId]);

  const loadRoster = async () => {
    setLoading(true);
    try {
      const result = await StudentRosterService.getRosterByExamId(examId);
      if (result.success && result.data) {
        setStudentIds(result.data.studentIds);
        setRosterId(result.data.id);
      } else {
        // Create new roster if doesn't exist
        const createResult = await StudentRosterService.createRoster(examId, [], userId);
        if (createResult.success && createResult.data) {
          setRosterId(createResult.data.id);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    const trimmedId = newStudentId.trim();
    
    if (!trimmedId) {
      setError('Please enter a student ID');
      return;
    }

    if (studentIds.includes(trimmedId)) {
      setError('This student ID is already in the roster');
      return;
    }

    if (!rosterId) {
      setError('Roster not initialized');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await StudentRosterService.addStudentToRoster(rosterId, trimmedId);
      
      if (result.success) {
        setStudentIds([...studentIds, trimmedId]);
        setNewStudentId('');
        setSuccess('Student added successfully');
        
        // Validate the new ID
        const validation = await StudentRosterService.validateStudentId(trimmedId);
        setValidationStatus({
          ...validationStatus,
          [trimmedId]: { exists: validation.exists, name: validation.studentName },
        });
        
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Failed to add student');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!rosterId) return;

    try {
      const result = await StudentRosterService.removeStudentFromRoster(rosterId, studentId);
      
      if (result.success) {
        setStudentIds(studentIds.filter((id) => id !== studentId));
        setSuccess('Student removed successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Failed to remove student');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !rosterId) return;

    setError(null);
    setSaving(true);

    try {
      // TODO: Implement CSV/Excel parsing with a library
      setError('Bulk upload feature coming soon. Please add students one at a time.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportRoster = () => {
    if (studentIds.length === 0) {
      setError('No students to export');
      return;
    }

    const headers = ['Student ID', 'Status', 'Validation'];
    const rows = studentIds.map((id) => {
      const status = validationStatus[id];
      return `${id},Registered,${status?.exists ? 'Valid' : 'Unverified'}`;
    });
    const csv = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roster-${examId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredStudents = studentIds.filter((id) =>
    id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">Loading roster...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Student Roster Management</CardTitle>
          <CardDescription>
            Add and manage students registered for this exam
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Alerts */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-500 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Add Student Form */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="student-id">Add Student ID</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="student-id"
                  placeholder="Enter student ID"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
                />
                <Button onClick={handleAddStudent} disabled={saving}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="flex gap-2">
            <Label htmlFor="bulk-upload" className="cursor-pointer flex-1">
              <div className="flex items-center gap-2 border-2 border-dashed rounded-lg p-3 hover:bg-accent transition-colors">
                <Upload className="h-4 w-4" />
                <span className="text-sm">Bulk Upload CSV/Excel</span>
              </div>
              <Input
                id="bulk-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleBulkUpload}
                className="hidden"
              />
            </Label>
            <Button variant="outline" onClick={handleExportRoster}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Roster List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Registered Students ({studentIds.length})</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {studentIds.length === 0 ? 'No students registered yet' : 'No students match your search'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((studentId) => (
                <div
                  key={studentId}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{studentId}</span>
                    {validationStatus[studentId] && (
                      <>
                        {validationStatus[studentId].exists ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Unverified</Badge>
                        )}
                        {validationStatus[studentId].name && (
                          <span className="text-sm text-muted-foreground">
                            {validationStatus[studentId].name}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveStudent(studentId)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
