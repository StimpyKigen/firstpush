import { create } from 'zustand';
import { useAuth } from './authStore';

export type ReportStatus = 'Pending' | 'Reviewed' | 'Dismissed';

export interface UserReport {
  id: string;
  postId: string;
  reportedUser: string;
  postContent?: string;
  reporterUsername: string;
  reasonCategory: string;
  description: string;
  createdAt: string;
  status: ReportStatus;
}

interface ReportsState {
  reports: UserReport[];
  loading: boolean;
  error: string | null;
  loadReports: () => Promise<void>;
  addReport: (report: Omit<UserReport, 'id' | 'createdAt' | 'status'>) => Promise<{ ok: boolean; error?: string }>;
  updateReportStatus: (id: string, status: ReportStatus) => Promise<{ ok: boolean; error?: string }>;
  deleteReport: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

function getModerationHeaders(includeContentType = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const userToken = useAuth.getState().userSessionToken;
  if (userToken) {
    headers['x-user-token'] = userToken;
  }
  if (typeof window !== 'undefined') {
    const adminToken = window.localStorage.getItem('mshindi_admin_token_v1');
    if (adminToken) {
      headers['x-admin-token'] = adminToken;
    }
  }
  return headers;
}

export const useReportsStore = create<ReportsState>()((set) => ({
  reports: [],
  loading: false,
  error: null,

  loadReports: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/moderation/reports', {
        method: 'GET',
        headers: getModerationHeaders(false),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        set({
          reports: [],
          loading: false,
          error: data?.error || 'Administrator authorization required to view moderation reports.',
        });
        return;
      }
      set({
        reports: Array.isArray(data.reports) ? data.reports : [],
        loading: false,
        error: null,
      });
    } catch {
      set({ loading: false, error: 'Failed to load reports from server.' });
    }
  },

  addReport: async (newReport) => {
    try {
      const res = await fetch('/api/moderation/reports', {
        method: 'POST',
        headers: getModerationHeaders(true),
        credentials: 'include',
        body: JSON.stringify(newReport),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        return { ok: false, error: data?.error || 'Failed to submit safety report.' };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach moderation server.' };
    }
  },

  updateReportStatus: async (id, status) => {
    try {
      const res = await fetch('/api/moderation/reports/status', {
        method: 'POST',
        headers: getModerationHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        return { ok: false, error: data?.error || 'Failed to update report status.' };
      }
      set((state) => ({
        reports: state.reports.map((r) => (r.id === id ? { ...r, status } : r)),
      }));
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach moderation server.' };
    }
  },

  deleteReport: async (id) => {
    try {
      const res = await fetch('/api/moderation/reports', {
        method: 'DELETE',
        headers: getModerationHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        return { ok: false, error: data?.error || 'Failed to delete report.' };
      }
      set((state) => ({
        reports: state.reports.filter((r) => r.id !== id),
      }));
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach moderation server.' };
    }
  },
}));
