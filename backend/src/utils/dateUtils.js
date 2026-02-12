/**
 * Centralized date utilities to prevent timezone-related bugs.
 *
 * Never use `new Date("YYYY-MM-DD")` directly — it parses as UTC midnight,
 * which shifts dates by -1 day in negative-UTC timezones.
 * Never use `toISOString().split('T')[0]` — it converts to UTC first,
 * which shifts dates by +1 day in the evening.
 */

/** Parse a "YYYY-MM-DD" string as local midnight (not UTC). */
const parseLocalDate = (dateStr) => new Date(dateStr + 'T00:00:00');

/** Format a Date (default: now) to "YYYY-MM-DD" using local components. */
const toDateStr = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/** Get today's date string, optionally in a specific timezone. */
const getTodayStr = (timezone) => {
    if (timezone) {
        return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
    }
    return toDateStr();
};

module.exports = { parseLocalDate, toDateStr, getTodayStr };
