import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flag, X, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useReportsStore } from '../lib/reportsStore';
import { useAuth, useCurrentUser } from '../lib/authStore';
import { showToast } from '../lib/notificationStore';
import Modal from './ui/Modal';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  reportedUser: string;
  postContent?: string;
}

const REASON_CATEGORIES = [
  'Scam / Fraudulent Content',
  'Spam or Solicitation (Paid Tips / DM Me)',
  'Misleading Odds / False Claims',
  'Abusive, Offensive, or Hate Speech',
  'Other Policy Violation',
];

export default function ReportModal({
  isOpen,
  onClose,
  postId,
  reportedUser,
  postContent,
}: ReportModalProps) {
  const currentUser = useCurrentUser();
  const addReport = useReportsStore((s) => s.addReport);

  const [category, setCategory] = useState(REASON_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleModalClose = () => {
    setDescription('');
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      showToast({
        type: 'warning',
        title: 'Description required',
        message: 'Please provide a short description for why you are reporting this post.',
      });
      return;
    }

    if (description.trim().length < 5) {
      showToast({
        type: 'warning',
        title: 'Description too short',
        message: 'Please explain the issue in a few words.',
      });
      return;
    }

    setSubmitting(true);

    setTimeout(() => {
      addReport({
        postId,
        reportedUser,
        postContent: postContent || '',
        reporterUsername: currentUser?.username || 'Anonymous',
        reasonCategory: category,
        description: description.trim(),
      });

      setSubmitting(false);
      setSubmitted(true);

      showToast({
        type: 'success',
        title: 'Report Submitted',
        message: 'Thank you for helping keep MshindiRoom safe. Our moderation team will review this post.',
      });

      setTimeout(() => {
        handleModalClose();
      }, 1500);
    }, 400);
  };

  return (
    <AnimatePresence>
      <Modal isOpen={isOpen} overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-panel border border-line rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line bg-panel-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <Flag size={16} />
              </div>
              <div>
                <h3 className="font-bold text-base text-cream">Report Post</h3>
                <p className="text-xs text-cream-dim">Help us maintain community safety & trust</p>
              </div>
            </div>
            <button
              onClick={handleModalClose}
              className="text-cream-dim hover:text-cream p-1.5 rounded-lg hover:bg-panel transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {submitted ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="font-bold text-lg text-cream">Report Received</h4>
              <p className="text-xs text-cream-dim max-w-sm mx-auto">
                Thank you for reporting this post by <strong className="text-gold">@{reportedUser}</strong>. Our safety team is looking into it.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
              {/* Context Summary */}
              <div className="bg-panel-2 border border-line/60 rounded-xl p-3 text-xs space-y-1">
                <div className="flex items-center justify-between text-cream-dim">
                  <span>Reporting user:</span>
                  <span className="font-bold text-gold">@{reportedUser}</span>
                </div>
                {postContent && (
                  <p className="text-cream-dim/80 line-clamp-2 italic pt-1 border-t border-line/40 text-[11px]">
                    "{postContent}"
                  </p>
                )}
              </div>

              {/* Category Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-cream uppercase tracking-wide">
                  Reason Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-ink/90 border border-line rounded-xl px-3 py-2.5 text-xs text-cream focus:outline-none focus:border-gold transition-colors"
                >
                  {REASON_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-cream uppercase tracking-wide">
                  Why are you reporting this post? <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide a short description (e.g. asking for money in DM, claiming 100% fixed bets, offensive content...)"
                  rows={3}
                  className="w-full bg-ink/90 border border-line rounded-xl p-3 text-xs text-cream placeholder:text-cream-dim/40 focus:outline-none focus:border-gold transition-colors resize-none"
                  required
                />
                <div className="flex justify-between text-[10px] text-cream-dim/70">
                  <span>Be concise and specific</span>
                  <span>{description.length} chars</span>
                </div>
              </div>

              {/* Notice */}
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-[11px] text-amber-300/90">
                <AlertTriangle size={14} className="shrink-0 text-amber-400 mt-0.5" />
                <span>
                  Reports are confidentially sent to Mshindi safety moderators. False or malicious reports violate terms of service.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 text-xs font-bold text-cream-dim hover:text-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !description.trim()}
                  className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  <Flag size={14} />
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </Modal>
    </AnimatePresence>
  );
}
