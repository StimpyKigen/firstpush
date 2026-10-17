import { Skeleton, SkeletonContainer } from './Skeleton';

export function LeaderboardSkeleton() {
  return (
    <SkeletonContainer label="Loading leaderboard and punter rankings...">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="w-36 h-4 rounded-full" />
          </div>
          <Skeleton className="w-72 sm:w-96 h-10 sm:h-12 rounded-lg mb-3" />
          <Skeleton className="w-full max-w-2xl h-4 rounded mb-1.5" />
          <Skeleton className="w-3/4 max-w-xl h-4 rounded" />
        </div>

        {/* User Stats 4-Grid Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="w-20 sm:w-24 h-3 rounded" />
                <Skeleton className="w-8 h-8 rounded-full" />
              </div>
              <Skeleton className="w-16 sm:w-20 h-8 sm:h-9 rounded mb-2" />
              <Skeleton className="w-28 sm:w-32 h-3 rounded" />
            </div>
          ))}
        </div>

        {/* Filter Bar: Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Skeleton className="w-20 h-9 rounded-full shrink-0" />
            <Skeleton className="w-24 h-9 rounded-full shrink-0" />
            <Skeleton className="w-20 h-9 rounded-full shrink-0" />
            <Skeleton className="w-24 h-9 rounded-full shrink-0" />
          </div>
          <Skeleton className="w-full sm:w-64 h-10 rounded-full" />
        </div>

        {/* Room Leaderboard Cards */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs overflow-hidden"
            >
              {/* Room Header Strip */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-20 h-3.5 rounded" />
                      <Skeleton className="w-16 h-4 rounded-full" />
                    </div>
                    <Skeleton className="w-48 sm:w-64 h-5 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <Skeleton className="w-24 h-6 rounded" />
                  <Skeleton className="w-8 h-8 rounded-full" />
                </div>
              </div>

              {/* Punter Rows (top 3 sample) */}
              <div className="pt-4 divide-y divide-slate-100">
                {Array.from({ length: 3 }).map((_, pIdx) => (
                  <div key={pIdx} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                      <div className="space-y-1">
                        <Skeleton className="w-28 sm:w-36 h-4 rounded" />
                        <Skeleton className="w-20 h-3 rounded" />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:block">
                        <Skeleton className="w-24 h-2.5 rounded-full" />
                      </div>
                      <Skeleton className="w-14 h-5 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonContainer>
  );
}
