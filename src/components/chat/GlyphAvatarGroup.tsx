import React from 'react';
import Avatar from '../Avatar';

export interface GlyphAvatarItem {
  id: string;
  name: string;
  colorSeed?: number;
  avatarId?: string;
}

interface GlyphAvatarGroupProps {
  users: GlyphAvatarItem[];
  max?: number;
  size?: number;
  className?: string;
}

export default function GlyphAvatarGroup({
  users,
  max = 3,
  size = 28,
  className = '',
}: GlyphAvatarGroupProps) {
  if (!users || users.length === 0) return null;

  const visibleUsers = users.slice(0, max);
  const remainingCount = users.length - max;

  return (
    <div className={`inline-flex items-center isolate select-none ${className}`}>
      {visibleUsers.map((user, idx) => {
        const seed = typeof user.colorSeed === 'number' ? user.colorSeed : user.name.length * 7;
        return (
          <div
            key={user.id || `${user.name}-${idx}`}
            className="relative transition-transform duration-150 hover:scale-110 hover:z-20 -ml-2 first:ml-0 rounded-md ring-2 ring-[#FFFFF0] dark:ring-[#202522] shadow-xs shrink-0"
            style={{ zIndex: 10 - idx }}
            title={user.name}
          >
            <Avatar
              name={user.name}
              seed={seed}
              size={size}
              avatarId={user.avatarId}
              showBorder={true}
            />
          </div>
        );
      })}

      {remainingCount > 0 && (
        <div
          className="relative -ml-2 rounded-full ring-2 ring-[#FFFFF0] dark:ring-[#202522] bg-[#F5F5E4] dark:bg-[#2A312C] text-slate-800 dark:text-[#E2E8F0] border border-[#DCDCC8] dark:border-[#414A43] shadow-xs flex items-center justify-center font-bold text-[10px] tabular-nums px-1 min-w-[20px] h-[20px] shrink-0"
          style={{ zIndex: 5 }}
          title={`${remainingCount} more punters`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
