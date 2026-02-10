'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { X } from 'lucide-react';

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
}

export function CreateExamModal({ isOpen, onClose, onCreateExam }: CreateExamModalProps) {
  const [formData, setFormData] = useState<ExamFormData>({
    name: '',
    totalQuestions: 50,
    date: new Date().toISOString().split('T')[0],
    folder: 'General'
  });

  const [step, setStep] = useState(1); // Step 1: Name, Step 2: Questions, Step 3: Date & Folder

  const handleInputChange = (field: keyof ExamFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateExam = () => {
    if (!formData.name.trim()) {
      alert('Please enter an exam name');
      return;
    }
    onCreateExam(formData);
    setFormData({
      name: '',
      totalQuestions: 50,
      date: new Date().toISOString().split('T')[0],
      folder: 'General'
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

          {/* Step 3: Date & Folder */}
          {step === 3 && (
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
            {[1, 2, 3].map((s) => (
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
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors"
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
