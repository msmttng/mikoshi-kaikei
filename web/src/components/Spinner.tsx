// ===================================
// ローディングスピナーコンポーネント
// ===================================

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-3',
    lg: 'w-10 h-10 border-4',
  };

  return (
    <div
      className={`${sizeClasses[size]} border-matsuri-100 border-t-matsuri-600 
        rounded-full animate-spin ${className}`}
      role="status"
      aria-label="読み込み中"
    />
  );
}
