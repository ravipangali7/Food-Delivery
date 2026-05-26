import { cn } from '@/lib/utils';

type BrandLogoProps = {
  src: string;
  alt?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'splash';
};

const sizeClass: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: 'h-8 w-auto max-w-[120px]',
  md: 'h-10 w-auto max-w-[140px]',
  lg: 'h-12 w-auto max-w-[160px]',
  splash: 'h-32 w-auto max-w-[280px]',
};

/** Store logo — object-contain preserves Shyam's wordmark aspect ratio. */
export default function BrandLogo({ src, alt = "Shyam's", className, size = 'md' }: BrandLogoProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn('brand-logo shrink-0', sizeClass[size], className)}
    />
  );
}
