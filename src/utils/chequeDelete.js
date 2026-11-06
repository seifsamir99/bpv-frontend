// Deleting / hiding cheques shown on the PDC and CDC trackers.
//
// Most tracker rows are DERIVED from BPV voucher line items, so "deleting" one
// can mean two different things — the user picks each time:
//   * Delete from BPV  — remove that cheque's line item(s) from the voucher.
//                        If nothing is left, the whole voucher is deleted.
//   * Hide from tracker — leave the voucher alone, just stop listing the cheque.
//
// Hiding reuses the existing per-cheque status tables (pdc_status/cdc_status)
// with a status of 'Hidden'. The key includes the BPV number, not just the
// cheque number, because cheque numbers repeat (e.g. several "Cash" entries)
// and hiding one must not hide the others.
import { bpvApi } from '../services/api';
import { API_BASE as API_BASE_URL } from '../services/apiBase';

export const HIDDEN_STATUS = 'Hidden';

const norm = (v) => String(v ?? '').trim();

export function hiddenKey(bpvNo, chequeNo) {
  return `hidden:${norm(bpvNo)}:${norm(chequeNo)}`;
}

export function isHidden(statusMap, cheque) {
  return (statusMap || {})[hiddenKey(cheque.bpvNo, cheque.chequeNo)] === HIDDEN_STATUS;
}

/** kind: 'pdc' | 'cdc' */
export async function hideCheque(kind, cheque) {
  const key = hiddenKey(cheque.bpvNo, cheque.chequeNo);
  const res = await fetch(`${API_BASE_URL}/${kind}/status-by-cheque/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: HIDDEN_STATUS }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || 'Could not hide the cheque');
  }
}

/**
 * Remove every line item carrying this cheque number from its BPV voucher.
 * Returns 'updated' or 'deleted' (when it was the voucher's last line).
 */
export async function deleteChequeFromBpv(voucher, chequeNo) {
  if (!voucher) throw new Error('BPV voucher not found — refresh and try again');
  const remaining = (voucher.lineItems || [])
    .filter(item => norm(item.chequeNo) !== norm(chequeNo));

  if (remaining.length === 0) {
    const res = await bpvApi.delete(voucher.bpvNo);
    if (res && res.success === false) throw new Error(res.error || 'Delete failed');
    return 'deleted';
  }

  const res = await bpvApi.update(voucher.bpvNo, {
    bpvNo: voucher.bpvNo,
    date: voucher.date,
    pdcType: voucher.pdcType,
    lineItems: remaining.map((item, i) => ({ ...item, srNo: i + 1 })),
  });
  if (res && res.success === false) throw new Error(res.error || 'Update failed');
  return 'updated';
}
