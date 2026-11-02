import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '../../lib/utills';
import { Input } from './input';

export interface TextFieldProps extends ComponentProps<'input'> {
  label: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export function TextField({
  label,
  error,
  helperText,
  id,
  className,
  containerClassName,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const describedBy =
    [props['aria-describedby'], error || helperText ? messageId : undefined].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={cn('text-field', containerClassName)} data-invalid={error ? true : undefined}>
      <label htmlFor={inputId} className="text-field-label">
        {label}
      </label>
      <Input
        {...props}
        id={inputId}
        className={cn('text-field-input', className)}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={describedBy}
      />
      {(error || helperText) && (
        <p
          id={messageId}
          className={cn('text-field-message', error && 'text-field-error')}
          role={error ? 'alert' : undefined}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
}

export interface FormFieldProps {
  label: string;
  /** Applied to the label so custom controls can reference it via aria-labelledby. */
  labelId: string;
  children: ReactNode;
  className?: string;
}

/** Same label + spacing as TextField, for custom controls (selects, date pickers). */
export function FormField({ label, labelId, children, className }: FormFieldProps) {
  return (
    <div className={cn('text-field', className)}>
      <span id={labelId} className="text-field-label">
        {label}
      </span>
      {children}
    </div>
  );
}

export interface TextAreaFieldProps extends ComponentProps<'textarea'> {
  label: string;
  containerClassName?: string;
}

export function TextAreaField({ label, id, className, containerClassName, ...props }: TextAreaFieldProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <div className={cn('text-field', containerClassName)}>
      <label htmlFor={textareaId} className="text-field-label">
        {label}
      </label>
      <textarea {...props} id={textareaId} className={cn('text-field-input', className)} />
    </div>
  );
}
