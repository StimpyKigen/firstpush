import * as React from 'react';
import { motion } from 'motion/react';

export interface BadgeCheckProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  animateOnHover?: boolean;
  loop?: boolean;
}

export const BadgeCheck = React.forwardRef<SVGSVGElement, BadgeCheckProps>(
  (
    {
      size = 18,
      className = 'w-4 h-4 sm:w-[17px] sm:h-[17px] text-emerald-400 shrink-0 drop-shadow-xs',
      animateOnHover = true,
      loop = true,
      ...props
    },
    ref
  ) => {
    return (
      <motion.svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        whileHover={
          animateOnHover
            ? {
                scale: 1.15,
                filter: 'drop-shadow(0 0 6px rgba(52,211,153,0.65))',
              }
            : undefined
        }
        whileTap={animateOnHover ? { scale: 0.92 } : undefined}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={`select-none ${className}`}
        {...(props as any)}
      >
        <style>{`
          @keyframes badgeCheckPulseUniform {
            0%, 100% { transform: scale(1); }
            45% { transform: scale(0.92); }
            60% { transform: scale(1.04); }
            75% { transform: scale(1); }
          }
          @keyframes badgeCheckDrawUniform {
            0%, 35%, 100% { stroke-dashoffset: 0; opacity: 1; }
            50% { stroke-dashoffset: 14; opacity: 0.3; }
            70% { stroke-dashoffset: 0; opacity: 1; }
          }
        `}</style>
        <path
          d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
          style={
            loop
              ? {
                  transformOrigin: 'center',
                  animation: 'badgeCheckPulseUniform 3.2s ease-in-out infinite',
                }
              : undefined
          }
        />
        <path
          d="m9 12 2 2 4-4"
          strokeDasharray="14"
          style={
            loop
              ? {
                  animation: 'badgeCheckDrawUniform 3.2s ease-in-out infinite',
                }
              : undefined
          }
        />
      </motion.svg>
    );
  }
);

BadgeCheck.displayName = 'BadgeCheck';

export const BadgeCheckIcon = BadgeCheck;
export type BadgeCheckIconProps = BadgeCheckProps;
export default BadgeCheck;
