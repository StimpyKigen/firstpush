import React from 'react';
import { Skeleton, SkeletonContainer } from './Skeleton';

export interface EditorialCarouselSkeletonProps {
  className?: string;
  indicatorSlot?: React.ReactNode;
}

/**
 * EditorialCarouselSkeleton
 *
 * Coordinated full-card skeleton loader for the MshindiRoom Weekly Editorial carousel.
 * Accurately matches the responsive 2-column layout (photo left, headline & caption right),
 * preserving exact dimensions, 3:4 aspect ratio, and typography spacing with a dark stadium-emerald
 * shimmer (#06372a base, emerald/gold sweep) to prevent CLS and eliminate the black photo void.
 */
export function EditorialCarouselSkeleton({ className = '' }: EditorialCarouselSkeletonProps) {
  return (
    <SkeletonContainer
      label="Loading matchday stories and perspectives..."
      className={`w-full ${className}`}
    >
      <div className="flex flex-col sm:grid sm:grid-cols-12 sm:gap-6 lg:gap-10 items-start relative z-10 w-full select-none">
        {/* PHOTO CONTAINER: Compact on mobile for 1-screen fit, full column on desktop */}
        <div className="w-full sm:col-span-5 lg:col-span-4 flex flex-col items-start px-1 sm:px-0">
          <div className="relative w-[180px] xs:w-[200px] sm:w-full sm:max-w-[290px] lg:max-w-[340px] aspect-[3/4] min-h-0 sm:min-h-[360px] lg:min-h-[420px] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/10 bg-[#06372a]">
            <Skeleton
              tone="dark"
              className="w-full h-full rounded-xl sm:rounded-2xl lg:rounded-3xl"
            />
          </div>
        </div>

        {/* TEXT CONTAINER: Fits on 1 screen on mobile without scrolling */}
        <div className="w-full sm:col-span-7 lg:col-span-8 flex flex-col justify-start space-y-1.5 sm:space-y-3.5 text-left px-1 sm:px-0 sm:pl-4 lg:pl-6 pt-2 sm:pt-0">
          {/* Big News Heading Skeleton (Gold-equivalent proportion) */}
          <div className="space-y-1 sm:space-y-2.5 w-full">
            <Skeleton
              tone="dark"
              className="h-5 sm:h-7 md:h-9 lg:h-11 w-11/12 rounded-md sm:rounded-lg"
            />
            <Skeleton
              tone="dark"
              className="h-5 sm:h-7 md:h-9 lg:h-11 w-4/5 rounded-md sm:rounded-lg"
            />
          </div>

          {/* Caption Skeleton Lines (Reduced by 50% on desktop to match refined caption font) */}
          <div className="space-y-1.5 sm:space-y-2 w-full pt-0.5 sm:pt-1">
            <Skeleton
              tone="dark"
              className="h-3 sm:h-4 md:h-5 w-full rounded sm:rounded-md"
            />
            <Skeleton
              tone="dark"
              className="h-3 sm:h-4 md:h-5 w-11/12 rounded sm:rounded-md"
            />
            <Skeleton
              tone="dark"
              className="h-3 sm:h-4 md:h-5 w-3/4 rounded sm:rounded-md"
            />
          </div>

          {/* Read More Link Pill Skeleton */}
          <div className="pt-0.5 sm:pt-1.5">
            <Skeleton
              tone="dark"
              className="h-3 sm:h-4 w-24 sm:w-28 rounded-full"
            />
          </div>
        </div>
      </div>
    </SkeletonContainer>
  );
}
