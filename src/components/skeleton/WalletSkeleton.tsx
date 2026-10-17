import { Skeleton, SkeletonContainer } from './Skeleton';

export function WalletSkeleton() {
  return (
    <SkeletonContainer label="Loading wallet and transaction history...">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Skeleton className="w-14 h-14 rounded-full mb-3" />
          <Skeleton className="w-64 sm:w-80 h-9 sm:h-11 rounded-lg mb-2" />
          <Skeleton className="w-72 sm:w-96 h-4 rounded" />
        </div>

        {/* Balance Summary 2-Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="w-32 h-3 rounded" />
              <Skeleton className="w-8 h-8 rounded-full" />
            </div>
            <Skeleton className="w-36 h-9 rounded-lg" />
            <Skeleton className="w-24 h-3.5 rounded" />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="w-36 h-3 rounded" />
              <Skeleton className="w-8 h-8 rounded-full" />
            </div>
            <Skeleton className="w-32 h-9 rounded-lg" />
            <Skeleton className="w-28 h-3.5 rounded" />
          </div>
        </div>

        {/* Deposit & Action Box */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="w-40 h-5 rounded" />
              <Skeleton className="w-56 h-3.5 rounded" />
            </div>
          </div>

          {/* Preset Pills */}
          <div className="flex flex-wrap gap-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="w-20 h-10 rounded-full" />
            ))}
          </div>

          {/* Phone number copy strip */}
          <Skeleton className="w-full h-12 rounded-xl" />

          {/* Form input & button */}
          <div className="space-y-3">
            <Skeleton className="w-full h-12 rounded-xl" />
            <Skeleton className="w-full h-12 rounded-full" />
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <Skeleton className="w-36 h-5 rounded" />
            <Skeleton className="w-20 h-4 rounded" />
          </div>
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="w-40 sm:w-56 h-4 rounded" />
                    <Skeleton className="w-20 h-3 rounded" />
                  </div>
                </div>
                <Skeleton className="w-16 h-5 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonContainer>
  );
}
