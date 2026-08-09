import { ImageIcon, X, CheckCircle2 } from 'lucide-react';
import AvatarPicker from '../../components/AvatarPicker';

interface AvatarPanelProps {
  pendingAvatarId: string | undefined;
  setPendingAvatarId: (id: string) => void;
  avatarSaved: boolean;
  onSave: () => void;
  onClose: () => void;
}

export default function AvatarPanel({ pendingAvatarId, setPendingAvatarId, avatarSaved, onSave, onClose }: AvatarPanelProps) {
  return (
    <div className="bg-panel border border-gold/30 rounded-2xl p-6 sm:p-7 mb-6 animate-rise">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-bold text-lg text-cream flex items-center gap-2">
          <ImageIcon size={18} className="text-gold" /> Choose Your Avatar
        </h2>
        <button onClick={onClose} aria-label="Close" className="text-cream-dim hover:text-cream"><X size={18} /></button>
      </div>
      <p className="text-xs text-cream-dim mb-4">Pick a football-themed profile picture for your account.</p>
      <AvatarPicker selected={pendingAvatarId} onSelect={setPendingAvatarId} />
      {avatarSaved && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-2 font-semibold mt-4 animate-rise">
          <CheckCircle2 size={13} /> Avatar updated!
        </p>
      )}
      <button
        onClick={onSave}
        disabled={!pendingAvatarId}
        className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 disabled:opacity-40 text-ink font-bold text-sm py-3 rounded-lg transition-colors mt-5"
      >
        Save Avatar
      </button>
    </div>
  );
}
