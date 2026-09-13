export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function scorePassword(password: string): PasswordStrength {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(4, score) as PasswordStrength;
}

export function passwordStrengthLabel(score: PasswordStrength): string {
  switch (score) {
    case 0:
      return "";
    case 1:
      return "Weak";
    case 2:
      return "Fair";
    case 3:
      return "Good";
    case 4:
      return "Strong";
    default:
      return "";
  }
}

export function passwordStrengthColor(score: PasswordStrength): string {
  switch (score) {
    case 1:
      return "bg-red-400";
    case 2:
      return "bg-amber-400";
    case 3:
      return "bg-emerald-400";
    case 4:
      return "bg-emerald-500";
    default:
      return "bg-slate-200";
  }
}
