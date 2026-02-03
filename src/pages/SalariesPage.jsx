import React, { useState } from 'react';
import { HiUserGroup } from 'react-icons/hi';
import PageHeader from '../components/PageHeader';
import SalaryList from '../components/SalaryList';
import SlideOutPanel from '../components/SlideOutPanel';
import SalaryForm from '../components/SalaryForm';
import { useSalaries } from '../hooks/useSalaries';

export default function SalariesPage() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState(null);

  const {
    salaries,
    loading,
    error,
    createSalary,
    updateSalary,
    deleteSalary,
    refetch
  } = useSalaries();

  const handleNewSalary = () => {
    setSelectedSalary(null);
    setPanelOpen(true);
  };

  const handleEditSalary = (salary) => {
    setSelectedSalary(salary);
    setPanelOpen(true);
  };

  const handleDeleteSalary = async (salary) => {
    if (window.confirm(`Delete salary record for ${salary.employeeName}?`)) {
      await deleteSalary(salary.id);
    }
  };

  const handleSaveSalary = async (id, data) => {
    let result;
    if (id) {
      result = await updateSalary(id, data);
    } else {
      result = await createSalary(data);
    }
    if (result?.success) {
      refetch();
    }
    return result;
  };

  const handleClosePanel = () => {
    setPanelOpen(false);
    setSelectedSalary(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Salaries"
        subtitle="Employee Payments"
        icon={HiUserGroup}
        onAction={handleNewSalary}
        actionLabel="New Salary"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SalaryList
          salaries={salaries}
          loading={loading}
          error={error}
          onEdit={handleEditSalary}
          onDelete={handleDeleteSalary}
        />
      </main>

      <SlideOutPanel
        isOpen={panelOpen}
        onClose={handleClosePanel}
        title={selectedSalary ? `Edit Salary - ${selectedSalary.employeeName}` : 'New Salary'}
      >
        <SalaryForm
          salary={selectedSalary}
          onSave={handleSaveSalary}
          onDelete={handleDeleteSalary}
          onClose={handleClosePanel}
          salaries={salaries}
        />
      </SlideOutPanel>
    </div>
  );
}
