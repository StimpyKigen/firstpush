import React from 'react';
import { cn } from '../../../lib/utils';

export type ClassicProps = Omit<React.ComponentProps<'span'>, 'children'>;

export function Classic({ className, ...props }: ClassicProps) {
  return (
    <>
      <style>{`
        @keyframes loading-ui-classic-fade {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0.15;
          }
        }
      `}</style>
      <span
        role="status"
        className={cn('inline-flex items-center justify-center size-6 text-[#006C54] dark:text-emerald-400', className)}
        {...props}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-full overflow-visible"
          fill="currentColor"
          aria-hidden="true"
        >
          {Array.from({ length: 12 }, (_, index) => (
            <rect
              key={index}
              x="11"
              y="1.5"
              width="2"
              height="5.5"
              rx="1"
              transform={`rotate(${index * 30} 12 12)`}
              style={{
                animation: 'loading-ui-classic-fade var(--duration, 1.2s) linear infinite',
                animationDelay: `calc(var(--duration, 1.2s) / 12 * ${index - 12})`,
              }}
            />
          ))}
        </svg>
        <span className="sr-only">Loading</span>
      </span>
    </>
  );
}

export function ClassicDemo() {
  return <Classic className="size-16" />;
}

export default Classic;
