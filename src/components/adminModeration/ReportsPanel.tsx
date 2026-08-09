import { Flag, CheckCircle2, Check, Trash2 } from 'lucide-react';
import { useReportsStore } from '../../lib/reportsStore';
import { showToast } from '../../lib/notificationStore';

export default function ReportsPanel() {
  const reports = useReportsStore((s) => s.reports);
  const updateReportStatus = useReportsStore((s) => s.updateReportStatus);
  const deleteReport = useReportsStore((s) => s.deleteReport);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-panel border border-line p-4 rounded-xl">
        <div>
          <h3 className="font-bold text-base text-cream flex items-center gap-2">
            <Flag size={18} className="text-rose-400" /> User Scam & Fraud Reports
          </h3>
          <p className="text-xs text-cream-dim mt-0.5">
            Reports submitted by community members regarding fraudulent posts, paid tips spam, or misleading slips.
          </p>
        </div>
        <div className="text-xs font-bold text-cream-dim">
          Total Reports: <span className="text-gold font-mono">{reports.length}</span>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-panel border border-line rounded-2xl p-8 text-center text-cream-dim space-y-2">
          <CheckCircle2 size={32} className="mx-auto text-emerald-400 opacity-60" />
          <p className="font-bold text-sm text-cream">No Reports Submitted</p>
          <p className="text-xs">Community members have not reported any posts as fraudulent yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((rep) => (
            <div
              key={rep.id}
              className={`bg-panel border rounded-xl p-4 space-y-3 transition-all ${
                rep.status === 'Pending'
                  ? 'border-rose-500/40 bg-rose-950/10'
                  : 'border-line opacity-80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/40 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
                    {rep.reasonCategory}
                  </span>
                  <span className="text-xs text-cream-dim">
                    Reported by <strong className="text-cream">@{rep.reporterUsername}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-cream-dim/60 font-mono text-[11px]">
                    {new Date(rep.createdAt).toLocaleString()}
                  </span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${
                      rep.status === 'Pending'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : rep.status === 'Reviewed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-line text-cream-dim'
                    }`}
                  >
                    {rep.status}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-ink-2 p-3 rounded-lg border border-line/60 space-y-1">
                  <p className="text-[10px] font-bold text-cream-dim uppercase tracking-wider">Reported User & Post</p>
                  <p className="font-bold text-gold">@{rep.reportedUser}</p>
                  {rep.postContent && (
                    <p className="text-cream-dim/80 italic text-[11px] line-clamp-2">
                      "{rep.postContent}"
                    </p>
                  )}
                </div>
                <div className="bg-ink-2 p-3 rounded-lg border border-line/60 space-y-1">
                  <p className="text-[10px] font-bold text-cream-dim uppercase tracking-wider">Reporter Description</p>
                  <p className="text-cream leading-relaxed">{rep.description}</p>
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
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-1"
                  >
                    <Check size={13} /> Mark Reviewed
                  </button>
                )}
                {rep.status !== 'Dismissed' && (
                  <button
                    onClick={() => {
                      updateReportStatus(rep.id, 'Dismissed');
                      showToast({ type: 'info', title: 'Report Dismissed', message: 'Report marked as dismissed.' });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-panel-2 border border-line text-cream-dim hover:text-cream font-semibold text-xs transition-colors"
                  >
                    Dismiss
                  </button>
                )}
                <button
                  onClick={() => {
                    deleteReport(rep.id);
                    showToast({ type: 'info', title: 'Report Deleted', message: 'Report removed.' });
                  }}
                  className="p-1.5 rounded-lg text-cream-dim/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
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
