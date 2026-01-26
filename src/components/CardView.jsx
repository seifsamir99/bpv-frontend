import React from 'react';
import VoucherCard from './VoucherCard';

export default function CardView({ vouchers, onEdit, onDelete }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {vouchers.map((voucher) => (
        <VoucherCard
          key={voucher.id}
          voucher={voucher}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
