/**
 * Form validation shared by the auth and add-plant screens.
 * Returns a human message or null so the caller can decide where to render it.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const emailIssue = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(trimmed)) return 'That email address does not look right.';
  return null;
};

export const passwordIssue = (value: string): string | null => {
  if (value.length === 0) return 'Enter a password.';
  if (value.length < 8) return 'Use at least 8 characters.';
  return null;
};

export const nicknameIssue = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Give your plant a nickname.';
  if (trimmed.length > 60) return 'Nicknames are limited to 60 characters.';
  return null;
};

/** `250` → `250 ml`, `0` → `Not recorded`. */
export const amountIssue = (value: string): string | null => {
  if (value.trim().length === 0) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5000) {
    return 'Enter an amount between 0 and 5000 ml.';
  }
  return null;
};
