export const normalizePhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber) return '';
  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  // If it doesn't start with '+', prepend it. Assuming international format.
  // For WhatsApp, numbers usually include country code.
  if (!phoneNumber.startsWith('+')) {
    return `+${digitsOnly}`;
  }
  return `+${digitsOnly}`;
};