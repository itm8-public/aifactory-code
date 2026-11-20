import { useId, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  /** Shown as text under the field. The palette has no red: the error is a strong border plus this text. */
  error?: string;
}

/** Text field with label, hint and error text wired up for screen readers. */
export function Input({ label, hint, error, id, className, ...rest }: InputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const noteId = `${inputId}-note`;
  return (
    <div className="itm8-field">
      {label ? (
        <label className="itm8-field__label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={['itm8-input', className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? noteId : undefined}
        {...rest}
      />
      {error ? (
        <span id={noteId} className="itm8-field__error">
          Error: {error}
        </span>
      ) : hint ? (
        <span id={noteId} className="itm8-field__hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
