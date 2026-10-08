export function authScope(path) {
  const page = path.toLowerCase();
  return page.includes('driver') ? 'driver' : page.includes('rider') ? 'rider' : page.includes('admin') ? 'admin' : 'public';
}
export function phoneNumber(value) {
  let text = String(value ?? '').trim();
  // A numeric value cannot recover digits already lost when it was originally saved.
  text = text.split(/(?:ext\.?|extension|x|#)\s*\d+/i)[0];
  const digits = text.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return '';
  return (text.startsWith('+') ? '+' : text.startsWith('00') ? '+' : '') + (text.startsWith('00') ? digits.slice(2) : digits);
}
export function vehicleIcon(type = 'ride') {
  const shape = type === 'tow' ? '<path d="M3 20h20V9h11l8 11v10H3zM23 20h19M28 10v9h10M5 19V6h8v5h8"/>' : type === 'messenger' ? '<circle cx="10" cy="27" r="8"/><circle cx="36" cy="27" r="8"/><path d="m10 27 10-17 10 17H10l7-12h16l3 12M17 7h8M31 7h5l-3 8"/>' : '<path d="m5 18 5-10h24l6 10v13H5zM5 18h35M13 10l-3 8M30 10l5 8"/>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 40" width="38" height="32" aria-hidden="true"><g fill="white" stroke="#0875e1" stroke-width="3" stroke-linejoin="round">' + shape + (type === 'messenger' ? '' : '<circle cx="12" cy="30" r="5"/><circle cx="34" cy="30" r="5"/>') + '</g></svg>';
}

export const escapeHTML = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
