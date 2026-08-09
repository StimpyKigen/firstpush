import { Star, StarHalf } from 'lucide-react';

export default function StarRating({
  rating,
  size = 13,
  showNumber = true,
  className = '',
}: {
  rating: number; // 0-5, in 0.5 increments
  size?: number;
  showNumber?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, rating));
  const full = Math.floor(clamped);
  const hasHalf = clamped - full >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex items-center" style={{ gap: 1 }}>
        {Array.from({ length: full }).map((_, i) => (
          <Star key={`f-${i}`} size={size} className="text-gold" fill="#f2b705" strokeWidth={0} />
        ))}
        {hasHalf && <StarHalf size={size} className="text-gold" fill="#f2b705" strokeWidth={0} />}
        {Array.from({ length: empty }).map((_, i) => (
          <Star key={`e-${i}`} size={size} className="text-line" fill="none" strokeWidth={1.5} />
        ))}
      </div>
      {showNumber && (
        <span className="font-mono font-semibold text-cream-dim" style={{ fontSize: size * 0.8 }}>
          {clamped.toFixed(1)}
        </span>
      )}
    </div>
  );
}
