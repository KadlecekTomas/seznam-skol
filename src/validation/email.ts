const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const GENERIC_LOCAL_PARTS = new Set([
  "info",
  "office",
  "sekretariat",
  "sekretariát",
  "kancelar",
  "kancelář",
  "skola",
  "škola",
]);

export const normalizeEmail = (value: string): string =>
  value.trim().toLocaleLowerCase("cs-CZ");

export const isValidEmailSyntax = (value: string): boolean =>
  EMAIL_PATTERN.test(normalizeEmail(value));

export const getEmailLocalPart = (value: string): string | null => {
  const normalized = normalizeEmail(value);
  const atIndex = normalized.lastIndexOf("@");

  if (atIndex <= 0) {
    return null;
  }

  return normalized.slice(0, atIndex);
};

export const isGenericMailbox = (value: string): boolean => {
  const localPart = getEmailLocalPart(value);

  if (!localPart) {
    return false;
  }

  return GENERIC_LOCAL_PARTS.has(localPart);
};
