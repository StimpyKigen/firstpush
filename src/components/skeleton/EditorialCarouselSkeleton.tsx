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
        {/* PHOTO CONTAINER: Full width enlarged hero on mobile, col-span-5/4 on desktop */}
        <div className="w-full sm:col-span-5 lg:col-span-4 flex flex-col items-start px-1 sm:px-0">
          <div className="relative w-full max-w-[440px] sm:max-w-[290px] lg:max-w-[340px] aspect-[3/4] min-h-[350px] sm:min-h-[360px] lg:min-h-[420px] rounded-2xl sm:rounded-2xl lg:rounded-3xl overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/10 bg-[#06372a]">
            <Skeleton
              tone="dark"
              className="w-full h-full rounded-2xl sm:rounded-2xl lg:rounded-3xl"
            />
          </div>
        </div>

        {/* TEXT CONTAINER: Shifted directly to bottom on mobile, starting on same vertical line as section heading */}
        <div className="w-full sm:col-span-7 lg:col-span-8 flex flex-col justify-start space-y-2 sm:space-y-4 text-left px-1 sm:px-0 sm:pl-4 lg:pl-6 pt-4 sm:pt-0">
          {/* Big News Heading Skeleton (Gold-equivalent proportion) */}
          <div className="space-y-1 sm:space-y-2.5 w-full">
            <Skeleton
              tone="dark"
              className="h-6 sm:h-7 md:h-10 lg:h-12 w-11/12 rounded-md sm:rounded-lg"
            />
            <Skeleton
              tone="dark"
              className="h-6 sm:h-7 md:h-10 lg:h-12 w-4/5 rounded-md sm:rounded-lg"
            />
          </div>

          {/* Caption Skeleton Lines */}
          <div className="space-y-2 w-full pt-1 sm:pt-2">
            <Skeleton
              tone="dark"
              className="h-4 sm:h-6 md:h-7 lg:h-8 w-full rounded sm:rounded-md"
            />
            <Skeleton
              tone="dark"
              className="h-4 sm:h-6 md:h-7 lg:h-8 w-11/12 rounded sm:rounded-md"
            />
            <Skeleton
              tone="dark"
              className="h-4 sm:h-6 md:h-7 lg:h-8 w-3/4 rounded sm:rounded-md"
            />
          </div>

          {/* Read More Link Pill Skeleton */}
          <div className="pt-1 sm:pt-2">
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
