/**
 * Cheque dates are stored as free text on `bpv_line_items.cheque_date`, and
 * historically they were typed in two different orders: month-first up to
 * BPV #218, day-first from #219 on. Everything that reads them has to guess,
 * and the guess is the rule below: day-first only when the first number is
 * too big to be a month.
 *
 * That guess is wrong for any day-first date falling on the 1st-12th, which
 * is how cheques went missing from their month view (see
 * `execution/fix_cheque_date_format.py`). New entries avoid the guess
 * entirely by going through a date picker and being written month-first.
 *
 * Keep `parseChequeDate` and `STORAGE_FORMAT` in step with
 * `execution/fix_cheque_date_format.py`, which reproduces the same rule.
 */

// The one order every reader in the app agrees on.
export const STORAGE_FORMAT = 'MM/DD/YYYY';

const MIN_YEAR = 1900;
const MAX_YEAR = 2999;

/**
 * Read a stored cheque date the way the PDC and CDC month views read it.
 * Returns a Date, or null when the text is not three slash-separated parts.
 * May return an Invalid Date for non-numeric text, exactly as before.
 */
export const parseChequeDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = String(dateStr).split('/');
  if (parts.length !== 3) return null;

  const first = parseInt(parts[0]);
  const second = parseInt(parts[1]);
  const year = parseInt(parts[2]);

  // A first number over 12 cannot be a month, so the text is day-first.
  // Anything else is taken as month-first.
  return first > 12
    ? new Date(year, second - 1, first)
    : new Date(year, first - 1, second);
};

/**
 * True when the stored text holds something a date picker cannot show, so
 * the caller can surface the raw value instead of an empty-looking box.
 */
export const isUnrepresentable = (dateStr) => {
  if (!dateStr) return false;
  return toDateInputValue(dateStr) === '';
};

/** `yyyy-MM-dd` for an `<input type="date">`, or '' if it cannot be shown. */
export const toDateInputValue = (dateStr) => {
  const date = parseChequeDate(dateStr);
  if (!date || Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) return '';

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** `MM/DD/YYYY` from a date picker's `yyyy-MM-dd`, for storage. */
export const fromDateInputValue = (isoStr) => {
  if (!isoStr) return '';
  const [year, month, day] = String(isoStr).split('-');
  if (!year || !month || !day) return '';
  return `${month}/${day}/${year}`;
};
