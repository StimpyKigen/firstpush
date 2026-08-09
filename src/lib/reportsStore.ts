import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserReport {
  id: string;
  postId: string;
  reportedUser: string;
  postContent?: string;
  reporterUsername: string;
  reasonCategory: string;
  description: string;
  createdAt: string;
  status: 'Pending' | 'Reviewed' | 'Dismissed';
}

interface ReportsState {
  reports: UserReport[];
  addReport: (report: Omit<UserReport, 'id' | 'createdAt' | 'status'>) => void;
  updateReportStatus: (id: string, status: 'Pending' | 'Reviewed' | 'Dismissed') => void;
  deleteReport: (id: string) => void;
}

export const useReportsStore = create<ReportsState>()(
  persist(
    (set) => ({
      reports: [
        {
          id: 'rep-seed-1',
          postId: 'post-seed-1',
          reportedUser: 'BetGuru_Nbr1',
          postContent: '22Bet Booking Code: 8F7X9. 100% sure win guaranteed, dm for paid tips.',
          reporterUsername: 'PunterAlex',
          reasonCategory: 'Scam / Fraudulent Content',
          description: 'Promoting guaranteed 100% wins and asking for paid tips in DM.',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          status: 'Pending',
        },
      ],
      addReport: (newReport) =>
        set((state) => ({
          reports: [
            {
              ...newReport,
              id: `rep-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              createdAt: new Date().toISOString(),
              status: 'Pending',
            },
            ...state.reports,
          ],
        })),
      updateReportStatus: (id, status) =>
        set((state) => ({
          reports: state.reports.map((r) => (r.id === id ? { ...r, status } : r)),
        })),
      deleteReport: (id) =>
        set((state) => ({
          reports: state.reports.filter((r) => r.id !== id),
        })),
    }),
    { name: 'mshindi-user-reports' }
  )
);
