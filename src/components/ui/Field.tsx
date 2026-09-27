import { forwardRef, useState, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

const fieldClass =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50";

const fieldErrorClass =
  "mt-1 w-full rounded-md border border-red-400 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200";

type FieldWrapProps = {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
};

export function Field({ label, htmlFor, error, hint, required, children }: FieldWrapProps) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ invalid, className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`${invalid ? fieldErrorClass : fieldClass} ${className}`}
      {...props}
    />
  );
});

export const SecretInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function SecretInput({ invalid, className = "", type: _type, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  const base = invalid ? fieldErrorClass : fieldClass;

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        className={`${base} pr-10 ${className}`}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label={visible ? "Hide value" : "Show value"}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ invalid, className = "", children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={`${invalid ? fieldErrorClass : fieldClass} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, className = "", ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={`${invalid ? fieldErrorClass : fieldClass} ${className}`}
      {...props}
    />
  );
});
