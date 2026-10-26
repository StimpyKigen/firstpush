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
export function EditorialCarouselSkeleton({ className = '', indicatorSlot }: EditorialCarouselSkeletonProps) {
  return (
    <SkeletonContainer
      label="Loading matchday stories and perspectives..."
      className={`w-full ${className}`}
    >
      <div className="grid grid-cols-12 gap-1.5 sm:gap-6 lg:gap-10 items-start relative z-10 w-full select-none">
        {/* LEFT SIDE: 3:4 Photo Area Skeleton */}
        <div className="col-span-8 sm:col-span-5 lg:col-span-4 flex flex-col items-start sm:items-center justify-start">
          <div className="relative w-full max-w-[310px] sm:max-w-[290px] lg:max-w-[340px] aspect-[3/4] min-h-[350px] sm:min-h-[360px] lg:min-h-[420px] rounded-2xl sm:rounded-2xl lg:rounded-3xl overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/10 bg-[#06372a]">
            <Skeleton
              tone="dark"
              className="w-full h-full rounded-2xl sm:rounded-2xl lg:rounded-3xl"
            />
          </div>

          {/* Bottom Indicator (Passed in or fallback 5 dots placeholder) */}
          {indicatorSlot ? (
            indicatorSlot
          ) : (
            <div
              className="flex items-center justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-5 select-none w-full max-w-[310px] sm:max-w-[290px] lg:max-w-[340px]"
              aria-hidden="true"
            >
              <Skeleton tone="dark" className="w-5 sm:w-7 h-1.5 sm:h-2 rounded-full" />
              <Skeleton tone="dark" className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full" />
              <Skeleton tone="dark" className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full" />
              <Skeleton tone="dark" className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full" />
              <Skeleton tone="dark" className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full" />
            </div>
          )}
        </div>

        {/* RIGHT SIDE: Headline, Caption & Action Skeleton */}
        <div className="col-span-4 sm:col-span-7 lg:col-span-8 flex flex-col justify-start space-y-2 sm:space-y-4 text-left pl-1 sm:pl-4 lg:pl-6 pr-1 sm:pr-0">
          {/* Big News Heading Skeleton (Gold-equivalent proportion) */}
          <div className="space-y-1 sm:space-y-2.5 w-full">
            <Skeleton
              tone="dark"
              className="h-3.5 sm:h-7 md:h-10 lg:h-12 w-11/12 rounded-md sm:rounded-lg"
            />
            <Skeleton
              tone="dark"
              className="h-3.5 sm:h-7 md:h-10 lg:h-12 w-4/5 rounded-md sm:rounded-lg"
            />
          </div>

          {/* Caption Skeleton Lines */}
          <div className="space-y-1 sm:space-y-2 w-full pt-1 sm:pt-2">
            <Skeleton
              tone="dark"
              className="h-2.5 sm:h-5 md:h-6 lg:h-7 w-full rounded sm:rounded-md"
            />
            <Skeleton
              tone="dark"
              className="h-2.5 sm:h-5 md:h-6 lg:h-7 w-11/12 rounded sm:rounded-md"
            />
            <Skeleton
              tone="dark"
              className="h-2.5 sm:h-5 md:h-6 lg:h-7 w-3/4 rounded sm:rounded-md hidden sm:block"
            />
          </div>

          {/* Read More Link Pill Skeleton */}
          <div className="pt-0.5 sm:pt-2">
            <Skeleton
              tone="dark"
              className="h-2.5 sm:h-4 w-16 sm:w-28 rounded-full"
            />
          </div>
        </div>
      </div>
    </SkeletonContainer>
  );
}
