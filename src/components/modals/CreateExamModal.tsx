'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { X, Loader2 } from 'lucide-react';
import { getClasses, type Class } from '@/services/classService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateExam: (data: ExamFormData) => void;
}

interface ExamFormData {
  name: string;
  totalQuestions: number;
  date: string;
  folder: string;
  className: string; // Made required
  classId?: string; // Store the class ID for reference
  choicesPerItem?: number;
  examType?: 'board' | 'diagnostic';
}

export function CreateExamModal({ isOpen, onClose, onCreateExam }: CreateExamModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<ExamFormData>({
    name: '',
    totalQuestions: 50,
    date: new Date().toISOString().split('T')[0],
    folder: 'General',
    className: '', // Required field
    classId: undefined,
    choicesPerItem: 4,
    examType: 'board',
  });

  const [step, setStep] = useState(1);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Fetch classes from Firestore
  useEffect(() => {
    const fetchClassesData = async () => {
      if (!isOpen) return;
      
      try {
        setLoadingClasses(true);
        const userId = user?.id;
        const fetchedClasses = await getClasses(userId);
        setClasses(fetchedClasses);
      } catch (error) {
        console.error('Error fetching classes:', error);
        toast.error('Failed to load classes');
      } finally {
        setLoadingClasses(false);
      }
    };

    fetchClassesData();
  }, [isOpen, user]);

  const handleInputChange = (field: keyof ExamFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateExam = () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Please enter an exam name');
      return;
    }
    if (!formData.className) {
      toast.error('Please select a class');
      return;
    }
    if (!formData.date) {
      toast.error('Please select a date');
      return;
    }
    
    onCreateExam(formData);
    setFormData({
      name: '',
      totalQuestions: 50,
      date: new Date().toISOString().split('T')[0],
      folder: 'General',
      className: '',
      classId: undefined,
      choicesPerItem: 4,
      examType: 'board',
    });
    setStep(1);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md border-2 border-primary">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-foreground">Create New Exam</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Steps */}
        <div className="p-6 space-y-4">
          {/* Step 1: Exam Name */}
          {step === 1 && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-semibold text-foreground mb-2 block">Exam Name</span>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., Midterm Exam 2026"
                  className="w-full px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <p className="text-xs text-muted-foreground">Enter a descriptive name for this exam</p>
            </div>
          )}

          {/* Step 2: Number of Questions */}
          {step === 2 && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-foreground mb-3 block">Number of Questions</span>
                <div className="grid grid-cols-3 gap-2">
                  {[20, 50, 100].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleInputChange('totalQuestions', num)}
                      className={`py-3 px-2 rounded-md font-semibold text-sm transition-all ${
                        formData.totalQuestions === num
                          ? 'bg-primary text-primary-foreground border-2 border-primary'
                          : 'border-2 border-muted hover:border-primary'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          )}

          {/* Step 3: Number of Choices */}
          {step === 3 && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-foreground mb-3 block">Number of Choices per Question</span>
                <div className="grid grid-cols-2 gap-2">
                  {[4, 5].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleInputChange('choicesPerItem', num)}
                      className={`py-3 px-2 rounded-md font-semibold text-sm transition-all border-2 ${
                        formData.choicesPerItem === num
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted hover:border-primary'
                      }`}
                    >
                      {num} Choices (A-{String.fromCharCode(64 + num)})
                    </button>
                  ))}
                </div>
              </label>
            </div>
          )}

          {/* Step 4: Select Class */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <span className="text-sm font-semibold text-foreground mb-3 block">Select Class *</span>
                <p className="text-xs text-muted-foreground mb-3">Choose which class this exam is for</p>
              </div>
              {loadingClasses ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading classes...</span>
                </div>
              ) : classes.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No classes available. Please create a class first in the Classes page.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {classes.map((classItem) => (
                    <button
                      key={classItem.id}
                      onClick={() => {
                        handleInputChange('className', classItem.class_name);
                        handleInputChange('classId', classItem.id);
                      }}
                      className={`w-full text-left p-3 rounded-md border-2 transition-all ${
                        formData.classId === classItem.id
                          ? 'border-primary bg-primary/10'
                          : 'border-muted hover:border-primary'
                      }`}
                    >
                      <div className="font-medium">{classItem.class_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {classItem.course_subject} • Section {classItem.section_block} • {classItem.students.length} students
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Exam Type */}
          {step === 5 && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-foreground mb-3 block">Exam Type</span>
                <p className="text-xs text-muted-foreground mb-4">Select the type of exam</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleInputChange('examType', 'board')}
                    className={`p-4 rounded-md border-2 transition-all text-left ${
                      formData.examType === 'board'
                        ? 'border-primary bg-primary/10'
                        : 'border-muted hover:border-primary'
                    }`}
                  >
                    <div className="font-semibold">Board Exam</div>
                    <div className="text-xs text-muted-foreground">Regular exam assessment</div>
                  </button>
                  <button
                    onClick={() => handleInputChange('examType', 'diagnostic')}
                    className={`p-4 rounded-md border-2 transition-all text-left ${
                      formData.examType === 'diagnostic'
                        ? 'border-primary bg-primary/10'
                        : 'border-muted hover:border-primary'
                    }`}
                  >
                    <div className="font-semibold">Diagnostic Test</div>
                    <div className="text-xs text-muted-foreground">Diagnostic assessment</div>
                  </button>
                </div>
              </label>
            </div>
          )}

          {/* Step 6: Date & Folder */}
          {step === 6 && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-foreground mb-2 block">Exam Date</span>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className="w-full px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-foreground mb-2 block">Folder</span>
                <input
                  type="text"
                  value={formData.folder}
                  onChange={(e) => handleInputChange('folder', e.target.value)}
                  placeholder="Folder Name"
                  className="w-full px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>
          )}

          {/* Step Indicator */}
          <div className="flex gap-1 pt-4">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 px-4 py-2 border rounded-md font-semibold hover:bg-muted transition-colors"
            >
              Back
            </button>
          )}
          {step < 6 ? (
            <button
              onClick={() => {
                // Validate Step 4 (Class selection) before proceeding
                if (step === 4 && !formData.className) {
                  toast.error('Please select a class before continuing');
                  return;
                }
                setStep(step + 1);
              }}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
              disabled={step === 4 && classes.length === 0}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreateExam}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
            >
              Create Exam
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded-md font-semibold hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      </Card>
    </div>
  );
}
