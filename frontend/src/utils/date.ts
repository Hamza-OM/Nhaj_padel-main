/**
 * Formats a Date as YYYY-MM-DD in the *browser's own timezone*.
 *
 * The obvious-looking `date.toISOString().split('T')[0]` converts to UTC first,
 * which silently shifts the day backwards for any timezone ahead of UTC. In
 * Oman (UTC+4) that means every booking made between midnight and 4am would be
 * filed against the previous day, while the UI label — built from getDate() —
 * still showed the correct one. Always build the key from local components.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
