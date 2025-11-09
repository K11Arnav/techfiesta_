import React from 'react'
import clsx from 'clsx'

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export default function GlassButton({
  children,
  className,
  variant = 'primary',
  ...rest
}: GlassButtonProps) {
  const base = 'glass-button'
  const vclass =
    variant === 'primary'
      ? 'glass-button--primary'
      : variant === 'secondary'
      ? 'glass-button--secondary'
      : 'glass-button--ghost'

  return (
    <button className={clsx(base, vclass, className)} {...rest}>
      <span className="glass-button__content">{children}</span>
    </button>
  )
}
