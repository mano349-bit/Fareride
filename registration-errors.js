export function registrationErrorMessage(error, stage = 'registration') {
  const code = error?.code || '';
  const messages = {
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'Choose a password with at least six characters.',
    'auth/invalid-credential': 'This email already has an account. Use its correct password or reset it on the login page.',
    'auth/wrong-password': 'This email already has an account. Use its correct password or reset it on the login page.',
    'auth/operation-not-allowed': 'Email/password registration is disabled in Firebase. The administrator must enable it.',
    'auth/unauthorized-domain': 'This website is not authorized in Firebase Authentication. The administrator must add mano349-bit.github.io to Authorized domains.',
    'auth/invalid-continue-uri': 'Firebase could not use the verification email return address. Contact the administrator.',
    'auth/unauthorized-continue-uri': 'Firebase has not authorized the verification email return address. Contact the administrator.',
    'auth/network-request-failed': 'Cannot reach Firebase. Check your connection and try again.',
    'auth/too-many-requests': 'Firebase temporarily limited attempts. Wait a few minutes before trying again.',
    'permission-denied': 'Firebase database permissions blocked this registration. The administrator must check access to user profiles and applications.',
    'storage/unauthorized': 'Firebase blocked the document upload. The administrator must check private application upload permissions.',
    'storage/bucket-not-found': 'The configured Firebase upload bucket was not found. The administrator must check Storage setup.',
    'storage/project-not-found': 'Firebase Storage could not find the configured project. Contact the administrator.',
    'storage/quota-exceeded': 'Firebase document storage has reached its quota. Contact the administrator.',
    'storage/retry-limit-exceeded': 'The document upload timed out. Check your connection and try again.',
    'unavailable': 'Firebase is temporarily unavailable. Please try again.'
  };
  if (messages[code]) return messages[code] + ` (Step: ${stage}; code: ${code})`;
  if (!code && error?.message) return error.message;
  return `Registration could not finish at ${stage}. Contact the administrator${code ? ` (code: ${code})` : ''}.`;
}
