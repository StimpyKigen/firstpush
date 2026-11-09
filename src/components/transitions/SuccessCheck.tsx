import React from 'react';
import { cn } from '../../lib/utils';

export interface SuccessCheckProps extends React.HTMLAttributes<HTMLSpanElement> {
  active?: boolean;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * "Success check" transition from transitions.dev
 * Features fade, rotation, blur, Y-axis bobbing, and SVG path stroke draw.
 */
export function SuccessCheck({
  active = true,
  size = 28,
  strokeWidth = 3,
  className,
  ...props
}: SuccessCheckProps) {
  return (
    <>
      <style>{`
        :root {
          --check-opacity-dur: 400ms;
          --check-rotate-dur: 450ms;
          --check-rotate-from: 70deg;
          --check-bob-dur: 450ms;
          --check-y-amount: 14px;
          --check-blur-dur: 350ms;
          --check-blur-from: 6px;
          --check-path-dur: 450ms;
          --check-path-delay: 60ms;
          --check-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
          --check-ease-opacity: cubic-bezier(0.22, 1, 0.36, 1);
          --check-ease-rotate: cubic-bezier(0.22, 1, 0.36, 1);
          --check-ease-bob: cubic-bezier(0.34, 1.35, 0.64, 1);
          --check-ease-path: cubic-bezier(0.22, 1, 0.36, 1);
        }

        .t-success-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transform-origin: center;
          opacity: 0;
          will-change: transform, opacity, filter;
        }

        .t-success-check svg {
          display: block;
          overflow: visible;
        }

        .t-success-check svg path {
          stroke-dasharray: 32;
          stroke-dashoffset: 32;
        }

        .t-success-check[data-state="in"] {
          animation:
            t-check-fade   var(--check-opacity-dur) var(--check-ease-opacity) forwards,
            t-check-rotate var(--check-rotate-dur)  var(--check-ease-rotate)  forwards,
            t-check-blur   var(--check-blur-dur)    var(--check-ease-out)     forwards,
            t-check-bob    var(--check-bob-dur)     var(--check-ease-bob)     forwards;
        }

        .t-success-check[data-state="in"] svg path {
          animation: t-check-draw var(--check-path-dur) var(--check-ease-path) var(--check-path-delay, 60ms) forwards;
        }

        @keyframes t-check-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @keyframes t-check-rotate {
          from { transform: rotate(var(--check-rotate-from)); }
          to   { transform: rotate(0deg); }
        }

        @keyframes t-check-blur {
          from { filter: blur(var(--check-blur-from)); }
          to   { filter: blur(0); }
        }

        @keyframes t-check-bob {
          from { translate: 0 var(--check-y-amount); }
          to   { translate: 0 0; }
        }

        @keyframes t-check-draw {
          to { stroke-dashoffset: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .t-success-check {
            animation: none !important;
            opacity: 1 !important;
          }
          .t-success-check svg path {
            animation: none !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `}</style>
      <span
        className={cn('t-success-check text-current', className)}
        data-state={active ? 'in' : 'out'}
        aria-hidden="true"
        {...props}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Crisp checkmark path (length ~24 units) */}
          <path d="M4 12.5L9.5 18L20 6" />
        </svg>
      </span>
    </>
  );
}

export default SuccessCheck;
