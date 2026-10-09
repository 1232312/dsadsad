import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'primary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  default: 'border-border/60 bg-card/60 text-text hover:border-primary/40 hover:bg-primary/5',
  primary: 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20',
  ghost: 'border-transparent bg-transparent text-text-secondary hover:text-text hover:bg-card/40',
  danger: 'border-error/40 bg-error/10 text-error hover:bg-error/20',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border backdrop-blur-xl',
        'font-medium transition-all duration-300 ease-smooth active:scale-[0.98] will-change-transform',
        'disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
