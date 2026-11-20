export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES_HINT =
  'Use 8+ characters with uppercase, lowercase, a number, and a symbol.';

/**
 * Strong password: min 8 chars, upper, lower, digit, special.
 * Applied on account creation (and any future password-change flows).
 */
export function validateStrongPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one special character (e.g. !@#$%).';
  }
  return null;
}

export function getPasswordStrength(password: string): {
  score: number;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
} {
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score, label: 'Weak' };
  if (score === 3) return { score, label: 'Fair' };
  if (score === 4) return { score, label: 'Good' };
  return { score, label: 'Strong' };
}
