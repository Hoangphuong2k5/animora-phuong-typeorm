// Entity sổ giao dịch, theo đúng schema thật dbo.payments
// (animora-sqlserver-v0_1.sql v1.6, xem docs/schema-assumptions.md mục 9):
//  - cột phương thức là `method` (cash/bank/ewallet/cod), KHÔNG phải payment_method;
//  - kind 'charge'/'refund'; đúng 1 trong 2 cột booking_id / order_id khác NULL;
//  - SPAY-05 chỉ dùng dòng kind='charge', method='cash', status='success'.
// File này chỉ định nghĩa bảng payments. Nghiệp vụ thu tiền mặt nằm ở
// cash-payment.* để không đụng file payment.* của Toàn (VNPAY).
const { EntitySchema } = require('typeorm');

const PaymentEntity = new EntitySchema({
  name: 'Payment',
  tableName: 'payments',
  columns: {
    id: { type: 'bigint', primary: true, generated: 'increment' },
    booking_id: { type: 'bigint', nullable: true },
    order_id: { type: 'bigint', nullable: true },
    kind: { type: 'nvarchar', length: 10, default: 'charge' }, // charge, refund
    amount: { type: 'decimal', precision: 15, scale: 2, nullable: false },
    method: { type: 'nvarchar', length: 20, nullable: false }, // cash, bank, ewallet, cod
    provider: { type: 'nvarchar', length: 50, nullable: true },
    txn_ref: { type: 'nvarchar', length: 100, nullable: true },
    status: { type: 'nvarchar', length: 20, default: 'pending' }, // pending, success, failed
    paid_at: { type: 'datetime2', precision: 0, nullable: true },
    confirmed_by: { type: 'bigint', nullable: true },
    note: { type: 'nvarchar', length: 255, nullable: true },
    created_at: { type: 'datetime2', precision: 0, createDate: true },
  },
});

module.exports = { PaymentEntity };
