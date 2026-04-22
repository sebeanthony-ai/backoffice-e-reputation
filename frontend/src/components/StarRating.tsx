interface StarRatingProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function StarRating({ rating, size = 'sm' }: StarRatingProps) {
  const sizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

  return (
    <span className={`inline-flex items-center gap-0.5 ${sizes[size]}`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={i <= rating ? 'text-amber-400' : 'text-slate-300'}
        >
          ★
        </span>
      ))}
    </span>
  );
}
