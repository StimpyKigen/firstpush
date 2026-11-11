import { Flag, CheckCircle2, Check, Trash2 } from 'lucide-react';
import { useReportsStore } from '../../lib/reportsStore';
import { showToast } from '../../lib/notificationStore';

export default function ReportsPanel() {
  const reports = useReportsStore((s) => s.reports);
  const updateReportStatus = useReportsStore((s) => s.updateReportStatus);
  const deleteReport = useReportsStore((s) => s.deleteReport);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-panel border border-[#E5E5EA] dark:border-line p-4.5 rounded-2xl shadow-2xs">
        <div>
          <h3 className="font-semibold text-base text-slate-900 dark:text-cream flex items-center gap-2">
            <Flag size={18} className="text-rose-600 dark:text-rose-400" />
            <span>Community User & Safety Reports</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-cream-dim mt-0.5">
            Reports submitted by community members regarding fraudulent posts, scam links, or spam slips.
          </p>
        </div>
        <div className="text-xs font-semibold text-slate-600 dark:text-cream-dim">
          Total Reports: <span className="text-[#006C54] dark:text-[#00A881] tabular-nums font-bold">{reports.length}</span>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white dark:bg-panel border border-[#E5E5EA] dark:border-line rounded-2xl p-8 text-center text-slate-500 dark:text-cream-dim space-y-2 shadow-2xs">
          <CheckCircle2 size={32} className="mx-auto text-[#006C54] dark:text-[#00A881]" />
          <p className="font-semibold text-sm text-slate-800 dark:text-cream">No Reports Submitted</p>
          <p className="text-xs text-slate-400 dark:text-cream-dim">Community members have not reported any content yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((rep) => (
            <div
              key={rep.id}
              className={`bg-white dark:bg-panel border rounded-2xl p-4 sm:p-5 space-y-3 transition-all shadow-2xs ${
                rep.status === 'Pending'
                  ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20'
                  : 'border-[#E5E5EA] dark:border-line'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E5EA] dark:border-line pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/40 px-2.5 py-0.5 rounded-full border border-transparent dark:border-rose-800/40">
                    {rep.reasonCategory}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-cream-dim">
                    Reported by <strong className="text-slate-900 dark:text-cream font-semibold">@{rep.reporterUsername}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 dark:text-cream-dim tabular-nums text-[11px]">
                    {new Date(rep.createdAt).toLocaleString()}
                  </span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider ${
                      rep.status === 'Pending'
                        ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-transparent dark:border-amber-800/40'
                        : rep.status === 'Reviewed'
                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-800/40'
                        : 'bg-slate-100 dark:bg-panel-2 text-slate-600 dark:text-cream-dim border border-transparent dark:border-line'
                    }`}
                  >
                    {rep.status}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#FBFBFA] dark:bg-panel-2 p-3 rounded-xl border border-[#E5E5EA] dark:border-line space-y-1">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-cream-dim uppercase tracking-wider">Reported User & Post</p>
                  <p className="font-semibold text-slate-900 dark:text-cream">@{rep.reportedUser}</p>
                  {rep.postContent && (
                    <p className="text-slate-600 dark:text-cream-dim italic text-[11px] line-clamp-2">
                      "{rep.postContent}"
                    </p>
                  )}
                </div>
                <div className="bg-[#FBFBFA] dark:bg-panel-2 p-3 rounded-xl border border-[#E5E5EA] dark:border-line space-y-1">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-cream-dim uppercase tracking-wider">Reporter Description</p>
                  <p className="text-slate-700 dark:text-cream leading-relaxed">{rep.description}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                {rep.status === 'Pending' && (
                  <button
                    onClick={() => {
                      updateReportStatus(rep.id, 'Reviewed');
                      showToast({ type: 'success', title: 'Marked Reviewed', message: 'Report status updated to Reviewed.' });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#006C54] hover:bg-[#005441] text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Check size={13} />
                    <span>Mark Reviewed</span>
                  </button>
                )}
                {rep.status !== 'Dismissed' && (
                  <button
                    onClick={() => {
                      updateReportStatus(rep.id, 'Dismissed');
                      showToast({ type: 'info', title: 'Report Dismissed', message: 'Report marked as dismissed.' });
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-line text-slate-700 dark:text-cream-dim hover:bg-slate-100 dark:hover:bg-panel-2 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                )}
                <button
                  onClick={() => {
                    deleteReport(rep.id);
                    showToast({ type: 'info', title: 'Report Deleted', message: 'Report removed.' });
                  }}
                  className="p-1.5 rounded-xl text-slate-400 dark:text-cream-dim hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  title="Delete report entry"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
