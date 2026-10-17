import { Skeleton, SkeletonContainer } from './Skeleton';
import { JackpotGridSkeleton } from './JackpotCardSkeleton';

export function PageSkeleton({ title = 'Loading page...' }: { title?: string }) {
  return (
    <SkeletonContainer label={title} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header Skeleton */}
      <div className="text-center mb-8 sm:mb-10 flex flex-col items-center">
        {/* Top Badges */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <Skeleton className="w-24 h-4 rounded-full" />
          <span className="text-slate-300">·</span>
          <Skeleton className="w-28 h-4 rounded-full" />
          <span className="text-slate-300">·</span>
          <Skeleton className="w-32 h-4 rounded-full" />
        </div>

        {/* Main Title */}
        <Skeleton className="w-64 sm:w-96 h-10 sm:h-12 rounded-lg mb-3" />

        {/* Subtitle Lines */}
        <Skeleton className="w-full max-w-2xl h-4 rounded mb-1.5" />
        <Skeleton className="w-4/5 max-w-xl h-4 rounded" />

        {/* Action / Filter Pills */}
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          <Skeleton className="w-20 h-9 rounded-full" />
          <Skeleton className="w-24 h-9 rounded-full" />
          <Skeleton className="w-20 h-9 rounded-full" />
          <Skeleton className="w-24 h-9 rounded-full" />
        </div>
      </div>

      {/* Main Grid Cards */}
      <JackpotGridSkeleton count={6} />
    </SkeletonContainer>
  );
}
