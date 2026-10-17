import { Skeleton, SkeletonContainer } from './Skeleton';

export function MatchCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs gap-3">
      <div>
        {/* Tier & Status Bar */}
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <Skeleton className="w-24 h-5 rounded-full" />
          <Skeleton className="w-20 h-4 rounded-full" />
        </div>

        {/* Team Names and Match Header */}
        <div className="space-y-1.5 mt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="w-5 h-5 rounded-full shrink-0" />
            <Skeleton className="w-24 sm:w-28 h-5 rounded" />
            <span className="text-slate-300 text-xs font-normal">v</span>
            <Skeleton className="w-5 h-5 rounded-full shrink-0" />
            <Skeleton className="w-24 sm:w-28 h-5 rounded" />
          </div>
          <Skeleton className="w-36 h-3.5 rounded mt-1" />
        </div>

        {/* Blurb text lines */}
        <div className="space-y-1.5 mt-2.5">
          <Skeleton className="w-full h-3 rounded" />
          <Skeleton className="w-4/5 h-3 rounded" />
        </div>

        {/* Kickoff & Discussions count */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
          <Skeleton className="w-28 h-3.5 rounded" />
          <Skeleton className="w-24 h-3.5 rounded" />
        </div>

        {/* Odds Grid (3 buttons, min-h-[46px]) */}
        <div className="mt-3.5">
          <Skeleton className="w-28 h-2.5 rounded mb-1.5" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-[46px] rounded-md w-full" />
            <Skeleton className="h-[46px] rounded-md w-full" />
            <Skeleton className="h-[46px] rounded-md w-full" />
          </div>
        </div>

        {/* Consensus strip */}
        <div className="mt-3">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>

      {/* Dual action buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
        <Skeleton className="h-10 rounded-md w-full" />
        <Skeleton className="h-10 rounded-md w-full" />
      </div>
    </div>
  );
}

export function MatchListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <SkeletonContainer label="Loading upcoming matches...">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <MatchCardSkeleton key={i} />
        ))}
      </div>
    </SkeletonContainer>
  );
}
