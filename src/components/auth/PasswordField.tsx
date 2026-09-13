import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  passwordStrengthColor,
  passwordStrengthLabel,
  scorePassword,
} from "../../lib/passwordStrength";

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  showStrength?: boolean;
  autoComplete?: string;
  invalid?: boolean;
};

export function PasswordField({
  id,
  label,
  value,
  onChange,
  showStrength = false,
  autoComplete = "current-password",
  invalid = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const score = scorePassword(value);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={8}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-xl border bg-white py-2.5 pl-3 pr-10 text-sm transition-all duration-200 focus:outline-none focus:ring-2 ${
            invalid
              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
              : "border-slate-200 focus:border-brand focus:ring-brand/15"
          }`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {showStrength && value.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((segment) => (
              <div
                key={segment}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  score >= segment ? passwordStrengthColor(score) : "bg-slate-200"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500">{passwordStrengthLabel(score)}</p>
        </div>
      )}
    </div>
  );
}
