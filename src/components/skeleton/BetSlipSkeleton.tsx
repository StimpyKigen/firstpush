import { Skeleton, SkeletonContainer } from './Skeleton';

export function BetSlipCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      {/* Punter Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Skeleton className="w-28 h-4 rounded" />
              <Skeleton className="w-14 h-3.5 rounded-full" />
            </div>
            <Skeleton className="w-20 h-3 rounded" />
          </div>
        </div>
        <Skeleton className="w-16 h-7 rounded-full" />
      </div>

      {/* Slip Title & Odds Pill */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <Skeleton className="w-48 h-5 rounded" />
        <Skeleton className="w-20 h-6 rounded-full" />
      </div>

      {/* Match Legs (3 legs) */}
      <div className="space-y-2 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between text-xs py-1">
            <div className="space-y-1">
              <Skeleton className="w-40 sm:w-56 h-3.5 rounded" />
              <Skeleton className="w-24 h-2.5 rounded" />
            </div>
            <Skeleton className="w-14 h-4 rounded" />
          </div>
        ))}
      </div>

      {/* Bookie Code & Action Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <Skeleton className="w-28 h-8 rounded-lg" />
        <div className="flex items-center gap-2">
          <Skeleton className="w-20 h-8 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function BetSlipFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonContainer label="Loading bet slips feed...">
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <BetSlipCardSkeleton key={i} />
        ))}
      </div>
    </SkeletonContainer>
  );
}
