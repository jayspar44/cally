/**
 * Centralized date utilities to prevent timezone-related bugs.
 *
 * Never use `new Date("YYYY-MM-DD")` directly — it parses as UTC midnight,
 * which shifts dates by -1 day in negative-UTC timezones.
 * Never use `toISOString().split('T')[0]` — it converts to UTC first,
 * which shifts dates by +1 day in the evening.
 */

/** Parse a "YYYY-MM-DD" string as local midnight (not UTC). */
export const parseLocalDate = (dateStr) => new Date(dateStr + 'T00:00:00');

/** Format a Date (default: now) to "YYYY-MM-DD" using local components. */
export const toDateStr = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/** Check if a Date or "YYYY-MM-DD" string represents today (local). */
export const isToday = (date) => {
    const d = typeof date === 'string' ? parseLocalDate(date) : date;
    const now = new Date();
    return d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
};

/** Format a "YYYY-MM-DD" string for display using toLocaleDateString. */
export const formatDateDisplay = (dateStr, opts = {}) =>
    parseLocalDate(dateStr).toLocaleDateString(undefined, opts);

/** Format a timestamp (ISO string / epoch) to local "HH:MM" time. */
export const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
