// Entity đề xuất nhập thuốc (MED-09), theo file
// docs/migration-medicine-suggestions.sql.
// Bảng dbo.medicine_suggestions KHÔNG có trong schema gốc
// animora-sqlserver-v0_1.sql (v1.6) — nhóm phải chạy file migration đó trên
// database Animora TRƯỚC khi dùng endpoint medicine-suggestions, vì
// synchronize: false trong data-source.js nên TypeORM sẽ không tự tạo bảng.
const { EntitySchema } = require('typeorm');

const MedicineSuggestionEntity = new EntitySchema({
  name: 'MedicineSuggestion',
  tableName: 'medicine_suggestions',
  columns: {
    id: { type: 'bigint', primary: true, generated: 'increment' },
    suggested_by: { type: 'bigint', nullable: true },
    suggested_by_role: { type: 'nvarchar', length: 20, nullable: true },
    medicine_name: { type: 'nvarchar', length: 300, nullable: false },
    note: { type: 'nvarchar', length: 'MAX', nullable: true },
    status: { type: 'nvarchar', length: 20, default: 'pending' }, // pending, approved, rejected
    created_at: { type: 'datetime2', precision: 0, createDate: true },
  },
});

module.exports = { MedicineSuggestionEntity };
