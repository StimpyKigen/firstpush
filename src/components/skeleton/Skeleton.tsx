import React, { useState } from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rect' | 'circle' | 'pill' | 'text';
  className?: string;
}

/**
 * Base atomic Skeleton component.
 * Uses warm ivory shimmer matching Mshindi design system (#E8E8D5 base, #FFFFF0 sheen).
 * Accessible with role="presentation" and aria-hidden="true".
 */
export function Skeleton({
  variant = 'rect',
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const variantClass = {
    rect: 'rounded-lg',
    circle: 'rounded-full',
    pill: 'rounded-full',
    text: 'rounded-md h-4 my-0.5',
  }[variant];

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={`skeleton-shimmer shrink-0 ${variantClass} ${className}`}
      style={style}
      {...props}
    />
  );
}

/**
 * Multi-line skeleton text placeholder with configurable line count and last line width.
 */
export function SkeletonText({
  lines = 2,
  className = '',
  lastLineWidth = '68%',
}: {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 w-full ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className="w-full"
          style={i === lines - 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

/**
 * Avatar circle skeleton with configurable size.
 */
export function SkeletonAvatar({
  size = 40,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Skeleton
      variant="circle"
      className={className}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Progressive image component with integrated skeleton shimmer fallback.
 * Displays a smooth skeleton until the image finishes downloading, preventing layout shift (CLS).
 */
export function SkeletonImage({
  src,
  alt = '',
  className = '',
  skeletonClassName = '',
  containerClassName = '',
  aspectRatio,
  ...imgProps
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  skeletonClassName?: string;
  containerClassName?: string;
  aspectRatio?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`relative overflow-hidden rounded-[inherit] ${aspectRatio || ''} ${containerClassName}`}
      style={imgProps.style}
    >
      {!loaded && !hasError && (
        <div
          className={`absolute inset-0 skeleton-shimmer z-0 ${skeletonClassName}`}
          aria-hidden="true"
        />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setHasError(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        {...imgProps}
      />
    </div>
  );
}

/**
 * Screen reader accessible live region wrapper for loading states.
 */
export function SkeletonContainer({
  children,
  label = 'Loading content...',
  className = '',
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={`w-full ${className}`}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * Single discussion pick / comment row skeleton.
 */
export function PickRowSkeleton() {
  return (
    <div className="p-4 bg-white border-b border-slate-100 flex items-start gap-3">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="w-28 h-3.5 rounded" />
            <Skeleton className="w-14 h-4 rounded-full" />
          </div>
          <Skeleton className="w-12 h-3.5 rounded" />
        </div>
        <Skeleton className="w-full h-3 rounded" />
        <Skeleton className="w-4/5 h-3 rounded" />
      </div>
    </div>
  );
}

