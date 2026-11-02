import type { ComponentProps } from 'react';
import { LoaderCircle } from 'lucide-react';

export { TextField as Input } from './text-field';

interface ButtonProps extends ComponentProps<'button'> {
  loading?: boolean;
  variant?: 'outline' | 'primary';
}

export function Button({ loading, disabled, children, variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`auth-button auth-button--${variant} ${className} `}
    >
      {loading && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
