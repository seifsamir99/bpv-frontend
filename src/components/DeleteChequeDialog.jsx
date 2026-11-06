import React, { useState } from 'react';
import { HiTrash, HiEyeOff, HiX } from 'react-icons/hi';

/**
 * Confirm box for deleting a cheque from the PDC / CDC tracker.
 *
 * BPV-linked cheques get two choices (the user decides each time):
 *   Delete from BPV  — removes the cheque's line(s) from the voucher
 *   Hide from tracker — voucher untouched, cheque no longer listed
 * Manually added cheques just get a plain Delete.
 *
 * Props: cheque (row or null), voucher (its BPV voucher, if any),
 *        onDeleteFromBpv, onHide, onDeleteManual — async; onClose.
 */
export default function DeleteChequeDialog({ cheque, voucher, onDeleteFromBpv, onHide, onDeleteManual, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!cheque) return null;

  const isBpv = Boolean(cheque.bpvNo) && cheque.source !== 'manual';
  const chequeLines = isBpv
    ? (voucher?.lineItems || []).filter(i => String(i.chequeNo).trim() === String(cheque.chequeNo).trim()).length
    : 0;
  const removesWholeVoucher = isBpv && voucher && chequeLines >= (voucher.lineItems || []).length;

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={busy ? undefined : onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-800">Delete cheque {cheque.chequeNo}?</h3>
          <button onClick={onClose} disabled={busy} className="text-slate-400 hover:text-slate-600">
            <HiX className="w-5 h-5" />
          </button>
        </div>

        <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mb-4">
          <div className="font-medium text-slate-800">{cheque.company || '-'}</div>
          <div>{fmt(cheque.amount)} AED · {cheque.chequeDate}{isBpv ? ` · BPV #${cheque.bpvNo}` : ' · added manually'}</div>
        </div>

        {error && (
          <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>
        )}

        {isBpv ? (
          <div className="space-y-2">
            <button
              disabled={busy}
              onClick={() => run(onDeleteFromBpv)}
              className="w-full flex items-start gap-3 text-left p-3 rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-50"
            >
              <HiTrash className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <span>
                <span className="block font-semibold text-red-700">Delete from BPV #{cheque.bpvNo}</span>
                <span className="block text-xs text-slate-500">
                  {removesWholeVoucher
                    ? 'This is the only cheque on the voucher, so the whole BPV voucher will be deleted. Cannot be undone.'
                    : 'Removes this cheque’s line from the BPV voucher. Cannot be undone.'}
                </span>
              </span>
            </button>
            <button
              disabled={busy}
              onClick={() => run(onHide)}
              className="w-full flex items-start gap-3 text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              <HiEyeOff className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
              <span>
                <span className="block font-semibold text-slate-700">Hide from tracker only</span>
                <span className="block text-xs text-slate-500">The BPV voucher stays as it is; the cheque just stops showing here.</span>
              </span>
            </button>
          </div>
        ) : (
          <button
            disabled={busy}
            onClick={() => run(onDeleteManual)}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
          >
            <HiTrash className="w-5 h-5" /> Delete cheque
          </button>
        )}

        <button
          disabled={busy}
          onClick={onClose}
          className="w-full mt-2 p-2 text-sm text-slate-500 hover:text-slate-700"
        >
          {busy ? 'Working…' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
