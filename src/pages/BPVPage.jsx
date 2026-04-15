import React, { useState } from 'react';
import { HiDocumentText, HiCreditCard } from 'react-icons/hi';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import VoucherList from '../components/VoucherList';
import SlideOutPanel from '../components/SlideOutPanel';
import VoucherForm from '../components/VoucherForm';
import { useVouchers } from '../hooks/useVouchers';

export default function BPVPage() {
  const [view, setView] = useState('cards');
  const [typeFilter, setTypeFilter] = useState('all');
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [suggestedBpvNo, setSuggestedBpvNo] = useState(null);

  const {
    vouchers,
    loading,
    error,
    getNextBpvNumber,
    createVoucher,
    updateVoucher,
    deleteVoucher,
    refetch
  } = useVouchers();

  const handleNewVoucher = async () => {
    setSelectedVoucher(null);
    const nextNum = await getNextBpvNumber();
    setSuggestedBpvNo(nextNum);
    setPanelOpen(true);
  };

  const handleEditVoucher = (voucher) => {
    setSelectedVoucher(voucher);
    setPanelOpen(true);
  };

  const handleDeleteVoucher = async (voucher) => {
    if (window.confirm(`Delete voucher #${voucher.bpvNo || voucher.id}?`)) {
      await deleteVoucher(voucher.bpvNo);
    }
  };

  const handleSaveVoucher = async (id, data) => {
    let result;
    if (id) {
      result = await updateVoucher(id, data);
    } else {
      result = await createVoucher(data);
    }
    if (result?.success) {
      refetch();
    }
    return result;
  };

  const handleClosePanel = () => {
    setPanelOpen(false);
    setSelectedVoucher(null);
    setSuggestedBpvNo(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="BPV Manager"
        subtitle="Bank Payment Vouchers"
        icon={HiDocumentText}
        onAction={handleNewVoucher}
        actionLabel="New Voucher"
      />

      {/* Quick Links to Trackers */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Quick Links:</span>
          <Link
            to="/pdc"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-100 hover:bg-cyan-200 text-cyan-700 text-sm font-medium rounded-lg transition-colors"
          >
            <HiCreditCard className="w-4 h-4" />
            PDC Tracker
          </Link>
          <Link
            to="/cdc"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm font-medium rounded-lg transition-colors"
          >
            <HiCreditCard className="w-4 h-4" />
            CDC Tracker
          </Link>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <VoucherList
          vouchers={vouchers}
          loading={loading}
          error={error}
          view={view}
          onViewChange={setView}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          onEdit={handleEditVoucher}
          onDelete={handleDeleteVoucher}
        />
      </main>

      <SlideOutPanel
        isOpen={panelOpen}
        onClose={handleClosePanel}
        title={selectedVoucher ? `Edit BPV #${selectedVoucher.bpvNo || selectedVoucher.id}` : 'New Voucher'}
      >
        <VoucherForm
          voucher={selectedVoucher}
          onSave={handleSaveVoucher}
          onDelete={handleDeleteVoucher}
          onClose={handleClosePanel}
          suggestedBpvNo={suggestedBpvNo}
          vouchers={vouchers}
        />
      </SlideOutPanel>
    </div>
  );
}
