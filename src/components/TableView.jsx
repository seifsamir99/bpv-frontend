import React from 'react';
import { HiPencil, HiTrash, HiDocumentDownload } from 'react-icons/hi';

export default function TableView({ vouchers, onEdit, onDelete }) {
  const handleDownload = (voucher) => {
    const printWindow = window.open('', '_blank');
    const lineItems = voucher.lineItems || [];
    const typeColor = voucher.pdcType === 'PDC' ? '#90EE90' : '#FFB6C1';

    // Generate line items rows
    const lineItemsHtml = lineItems.map((item, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${item.description || ''}</td>
        <td>${item.companyName || ''}</td>
        <td style="text-align: center;">${item.chequeNo || ''}</td>
        <td style="text-align: center;">${item.chequeDate || ''}</td>
        <td style="text-align: right;">${item.debit?.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || ''}</td>
        <td style="text-align: right;">${item.credit?.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || ''}</td>
      </tr>
    `).join('');

    // Add empty rows to fill space (minimum 5 rows)
    const emptyRowsCount = Math.max(0, 5 - lineItems.length);
    const emptyRowsHtml = Array(emptyRowsCount).fill(`
      <tr>
        <td>&nbsp;</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>BPV #${voucher.bpvNo || voucher.id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; font-size: 12px; }
          .voucher { border: 2px solid #333; }
          .title { text-align: center; font-size: 18px; font-weight: bold; padding: 15px; border-bottom: 1px solid #333; }
          .header-section { display: flex; border-bottom: 1px solid #333; }
          .company-info { flex: 1; padding: 10px 15px; border-right: 1px solid #333; }
          .company-info h2 { font-size: 14px; margin-bottom: 5px; }
          .company-info p { font-size: 11px; margin: 2px 0; }
          .bpv-info { width: 200px; }
          .bpv-info table { width: 100%; border-collapse: collapse; }
          .bpv-info td { padding: 8px 10px; border-bottom: 1px solid #333; }
          .bpv-info td:first-child { font-weight: bold; border-right: 1px solid #333; width: 60px; }
          .bpv-info tr:last-child td { border-bottom: none; }
          .type-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-weight: bold; }
          .items-table { width: 100%; border-collapse: collapse; }
          .items-table th { background: #f0f0f0; font-weight: bold; padding: 8px 5px; border: 1px solid #333; font-size: 11px; }
          .items-table td { padding: 8px 5px; border: 1px solid #333; font-size: 11px; }
          .total-row td { background: #FFFF00; font-weight: bold; }
          .signature-section { display: flex; padding: 20px; border-top: 1px solid #333; }
          .signature-box { flex: 1; text-align: center; padding: 10px; }
          .signature-line { border-top: 1px solid #333; width: 150px; margin: 40px auto 5px; }
          @media print {
            body { padding: 10px; }
            .voucher { border-width: 1px; }
          }
        </style>
      </head>
      <body>
        <div class="voucher">
          <div class="title">BANK PAYMENT VOUCHER</div>

          <div class="header-section">
            <div class="company-info">
              <h2>NEWELL ELECTROMECHANICAL WORKS LLC</h2>
              <p>TRN : 100280024900003</p>
              <p>P.O BOX -88593  DUBAI  UNITED ARAB EMIRATES</p>
              <p>TEL 04 -8843367</p>
            </div>
            <div class="bpv-info">
              <table>
                <tr>
                  <td>BPV NO</td>
                  <td>${voucher.bpvNo || voucher.id} <span class="type-badge" style="background: ${typeColor};">${voucher.pdcType || 'PDC'}</span></td>
                </tr>
                <tr>
                  <td>Date</td>
                  <td>${voucher.date || ''}</td>
                </tr>
              </table>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 50px;">SR.NO</th>
                <th style="width: 200px;">DESCRIPTION</th>
                <th>COMPANY NAME</th>
                <th style="width: 70px;">CHQ</th>
                <th style="width: 90px;">CHQ DATE</th>
                <th style="width: 90px;">DEBIT</th>
                <th style="width: 80px;">CREDIT</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
              ${emptyRowsHtml}
              <tr class="total-row">
                <td colspan="5" style="text-align: right; padding-right: 20px;">TOTAL AMOUNT AED:</td>
                <td style="text-align: right;">${voucher.totalAmount?.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line"></div>
              <div>Received By</div>
            </div>
            <div class="signature-box">
              <div class="signature-line"></div>
              <div>Approved By</div>
            </div>
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                BPV #
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Company
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Amount (AED)
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vouchers.map((voucher) => {
              const isPDC = voucher.pdcType === 'PDC';
              const badgeColor = isPDC
                ? 'bg-blue-100 text-blue-700'
                : 'bg-orange-100 text-orange-700';

              return (
                <tr
                  key={voucher.id}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onEdit(voucher)}
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-800">
                      {voucher.bpvNo || voucher.id}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {voucher.date}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${badgeColor}`}>
                      {voucher.pdcType || 'PDC'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                    {voucher.lineItems?.[0]?.companyName || '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {voucher.totalAmount?.toLocaleString('en-AE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onEdit(voucher)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <HiPencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(voucher)}
                        className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Download PDF"
                      >
                        <HiDocumentDownload className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(voucher)}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <HiTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
