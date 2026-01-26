import React, { useState } from 'react';
import Header from './components/Header';
import VoucherList from './components/VoucherList';
import SlideOutPanel from './components/SlideOutPanel';
import VoucherForm from './components/VoucherForm';
import { useVouchers } from './hooks/useVouchers';

export default function App() {
  const [view, setView] = useState('cards');
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
    // Fetch the next BPV number for the new voucher
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
      await deleteVoucher(voucher.id);
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
      {/* Header */}
      <Header onNewVoucher={handleNewVoucher} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <VoucherList
          vouchers={vouchers}
          loading={loading}
          error={error}
          view={view}
          onViewChange={setView}
          onEdit={handleEditVoucher}
          onDelete={handleDeleteVoucher}
        />
      </main>

      {/* Slide-out Panel */}
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
        />
      </SlideOutPanel>
    </div>
  );
}
