import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldWrapperProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optionalLabel?: boolean;
  className?: string;
  id: string;
  children: ReactNode;
}

const controlBase =
  'block w-full rounded-xl border bg-white text-ink-900 placeholder:text-ink-400 transition-colors ' +
  'focus:outline-none focus:ring-[3px] focus:ring-brand-500/35 focus:border-brand-500 disabled:bg-ink-50 disabled:text-ink-500 ' +
  'aria-[invalid=true]:border-danger-500 aria-[invalid=true]:focus:ring-danger-500/30';

export function FieldWrapper({ label, hint, error, required, optionalLabel, className, id, children }: FieldWrapperProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-800">
        {label}
        {required && <span className="text-danger-600" aria-hidden="true"> *</span>}
        {!required && optionalLabel && <span className="ml-1 text-xs font-normal text-ink-500">(optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: ReactNode) {
  const ids: string[] = [];
  if (error) ids.push(`${id}-error`);
  else if (hint) ids.push(`${id}-hint`);
  return ids.length ? ids.join(' ') : undefined;
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optionalLabel?: boolean;
  wrapperClassName?: string;
  leftAddon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, optionalLabel, wrapperClassName, className, id: idProp, required, leftAddon, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldWrapper id={id} label={label} hint={hint} error={error} required={required} optionalLabel={optionalLabel} className={wrapperClassName}>
      <div className="relative">
        {leftAddon && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-400">{leftAddon}</span>}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn(controlBase, 'h-11 px-3.5 text-[15px]', leftAddon && 'pl-10', className)}
          {...rest}
        />
      </div>
    </FieldWrapper>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optionalLabel?: boolean;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, optionalLabel, wrapperClassName, className, id: idProp, required, rows = 4, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldWrapper id={id} label={label} hint={hint} error={error} required={required} optionalLabel={optionalLabel} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(controlBase, 'px-3.5 py-2.5 text-[15px] leading-relaxed resize-y', className)}
        {...rest}
      />
    </FieldWrapper>
  );
});

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optionalLabel?: boolean;
  wrapperClassName?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, optionalLabel, wrapperClassName, className, id: idProp, required, options, placeholder, ...rest },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldWrapper id={id} label={label} hint={hint} error={error} required={required} optionalLabel={optionalLabel} className={wrapperClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn(controlBase, 'h-11 appearance-none pl-3.5 pr-10 text-[15px]', className)}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled={required}>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
      </div>
    </FieldWrapper>
  );
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, description, error, id: idProp, className, ...rest }, ref) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <div className={cn('flex gap-3', className)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : description ? `${id}-desc` : undefined}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        {...rest}
      />
      <div className="text-sm">
        <label htmlFor={id} className="font-medium text-ink-800">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-ink-500">
            {description}
          </p>
        )}
        {error && (
          <p id={`${id}-error`} className="text-danger-700" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
});

export interface RadioCardOption<T extends string> {
  value: T;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

export function RadioCards<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  columns = 1,
}: {
  name: string;
  legend: ReactNode;
  options: RadioCardOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  error?: ReactNode;
  columns?: 1 | 2;
}) {
  const errId = useId();
  return (
    <fieldset aria-describedby={error ? errId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="mb-2 block text-sm font-medium text-ink-800">{legend}</legend>
      <div className={cn('grid gap-3', columns === 2 && 'sm:grid-cols-2')}>
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                'relative flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-brand-500/35',
                checked ? 'border-brand-500 bg-brand-50/60' : 'border-ink-200 bg-white hover:border-ink-300',
                o.disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="mt-1 h-4 w-4 shrink-0 border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                  {o.title}
                  {o.badge}
                </span>
                {o.description && <span className="mt-0.5 block text-sm text-ink-600">{o.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errId} className="mt-2 text-sm text-danger-700" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
