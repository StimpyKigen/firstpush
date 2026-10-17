import { Skeleton, SkeletonContainer } from './Skeleton';

export function RoomDetailSkeleton() {
  return (
    <SkeletonContainer label="Loading room details...">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between">
          <Skeleton className="w-32 h-5 rounded-full" />
          <Skeleton className="w-24 h-5 rounded-full" />
        </div>

        {/* Room Header Banner Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Skeleton className="w-14 h-14 rounded-2xl shrink-0" />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-20 h-3.5 rounded" />
                  <Skeleton className="w-16 h-4 rounded-full" />
                </div>
                <Skeleton className="w-48 sm:w-64 h-7 rounded-md" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="w-28 h-10 rounded-full" />
            </div>
          </div>

          {/* Stats Bar (Punters, Prize Pool, Closes) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
            <div>
              <Skeleton className="w-16 h-2.5 rounded mb-1.5" />
              <Skeleton className="w-24 h-6 rounded" />
            </div>
            <div>
              <Skeleton className="w-16 h-2.5 rounded mb-1.5" />
              <Skeleton className="w-20 h-6 rounded" />
            </div>
            <div>
              <Skeleton className="w-16 h-2.5 rounded mb-1.5" />
              <Skeleton className="w-24 h-6 rounded" />
            </div>
            <div>
              <Skeleton className="w-16 h-2.5 rounded mb-1.5" />
              <Skeleton className="w-20 h-6 rounded" />
            </div>
          </div>

          {/* Progress / Consensus Bar */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center">
              <Skeleton className="w-28 h-3.5 rounded" />
              <Skeleton className="w-16 h-3.5 rounded" />
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        </div>

        {/* Match Accordion Skeletons */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <Skeleton className="w-36 h-4 rounded" />
            <Skeleton className="w-24 h-4 rounded" />
          </div>

          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4"
            >
              {/* Match Header Row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Skeleton className="w-6 h-6 rounded-full" />
                  <Skeleton className="w-24 sm:w-32 h-5 rounded" />
                  <span className="text-slate-300 text-xs">v</span>
                  <Skeleton className="w-6 h-6 rounded-full" />
                  <Skeleton className="w-24 sm:w-32 h-5 rounded" />
                </div>
                <Skeleton className="w-20 h-4 rounded-full shrink-0" />
              </div>

              {/* Odds Grid */}
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-11 rounded-lg w-full" />
                <Skeleton className="h-11 rounded-lg w-full" />
                <Skeleton className="h-11 rounded-lg w-full" />
              </div>

              {/* Consensus Strip */}
              <Skeleton className="h-7 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonContainer>
  );
}
