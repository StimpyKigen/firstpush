import { Skeleton, SkeletonContainer } from './Skeleton';

export function JackpotCardSkeleton() {
  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Top theme strip */}
      <Skeleton className="h-1.5 w-full rounded-none" />

      <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1">
        {/* Header with bookie avatar & name + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-11 h-11 rounded-lg shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="w-16 h-2.5 rounded" />
              <Skeleton className="w-36 sm:w-44 h-5 rounded-md" />
            </div>
          </div>
          <Skeleton className="w-16 h-4 rounded-full" />
        </div>

        {/* Shared Picks Strip */}
        <Skeleton className="h-9 w-full rounded-lg" />

        {/* Gameweek & Match Count line */}
        <div className="flex items-center gap-2">
          <Skeleton className="w-20 h-3 rounded" />
          <span className="text-slate-300">·</span>
          <Skeleton className="w-16 h-3 rounded" />
        </div>

        {/* Live sync tag */}
        <Skeleton className="w-32 h-3 rounded" />

        {/* 2-Column Prize & Entry Fee Grid */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <Skeleton className="w-20 h-2.5 rounded mb-1" />
            <Skeleton className="w-28 h-6 sm:h-7 rounded" />
          </div>
          <div className="flex flex-col items-end">
            <Skeleton className="w-16 h-2.5 rounded mb-1" />
            <Skeleton className="w-20 h-6 sm:h-7 rounded" />
          </div>
        </div>

        {/* Footer row: Punters + Closes time */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Skeleton className="w-24 h-3.5 rounded" />
          <Skeleton className="w-20 h-3.5 rounded" />
        </div>
      </div>
    </div>
  );
}

export function JackpotGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <SkeletonContainer label="Loading jackpot rooms...">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <JackpotCardSkeleton key={i} />
        ))}
      </div>
    </SkeletonContainer>
  );
}
