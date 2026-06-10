'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';

export interface GenerateInternshipLetterInput {
  candidateName: string;
  candidateEmail: string;
  candidateAddress?: string;
  candidateCity?: string;
  candidatePhone?: string;
  position: string;
  department: string;
  startDate: string;
  endDate: string;
  stipendAmount: number;
  manager?: string;
  workHours?: string;
  workDays?: string;
  workMode?: string;
  acceptanceDeadline?: string;
  issueDate?: string;
  referenceNumber?: string;
}

export function useGenerateInternshipLetter() {
  return useMutation({
    mutationFn: async (input: GenerateInternshipLetterInput) => {
      const res = await api.post('/letters/internship', input, { responseType: 'blob' });
      const blob = new Blob([res.data as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Zlaark_Internship_${input.candidateName.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Internship letter downloaded'),
    onError: () => toast.error('Failed to generate letter'),
  });
}
