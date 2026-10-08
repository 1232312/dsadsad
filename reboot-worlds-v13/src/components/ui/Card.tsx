import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glass = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border p-lg',
        glass ? 'bg-card/60 backdrop-blur-xl border-border/60' : 'bg-card border-border',
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'
