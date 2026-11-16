// Entity đơn thuốc + chi tiết đơn, theo đúng schema thật dbo.prescriptions /
// dbo.prescription_items (animora-sqlserver-v0_1.sql v1.6, xem
// docs/schema-assumptions.md mục 11, 12):
//  - versioning bằng `version` + `parent_id` (KHÔNG có previous_version_id);
//  - `max_refills` (TINYINT) + `allow_reorder` (KHÔNG có purchase_count);
//  - KHÔNG có cột updated_at;
//  - items bắt buộc `product_name` (snapshot tên sản phẩm lúc kê) và có
//    `usage_note` (KHÔNG phải note); `quantity` là tổng số lượng được phép mua;
//  - UNIQUE theo cặp (medical_record_id, version);
//  - CHECK: severe thì allow_reorder=0 và max_refills=0.
const { EntitySchema } = require('typeorm');

const PrescriptionEntity = new EntitySchema({
  name: 'Prescription',
  tableName: 'prescriptions',
  columns: {
    id: { type: 'bigint', primary: true, generated: 'increment' },
    medical_record_id: { type: 'bigint', nullable: false },
    pet_id: { type: 'bigint', nullable: false },
    vet_id: { type: 'bigint', nullable: false }, // experts.id
    version: { type: 'int', default: 1 },
    parent_id: { type: 'bigint', nullable: true },
    severity: { type: 'nvarchar', length: 10, nullable: false }, // mild, severe
    status: { type: 'nvarchar', length: 20, default: 'draft' }, // draft, active, exhausted, expired, superseded
    allow_reorder: { type: 'bit', default: false },
    max_refills: { type: 'tinyint', default: 0 },
    valid_until: { type: 'date', nullable: true },
    note: { type: 'nvarchar', length: 255, nullable: true },
    issued_at: { type: 'datetime2', precision: 0, nullable: true },
    created_at: { type: 'datetime2', precision: 0, createDate: true },
  },
});

const PrescriptionItemEntity = new EntitySchema({
  name: 'PrescriptionItem',
  tableName: 'prescription_items',
  columns: {
    id: { type: 'bigint', primary: true, generated: 'increment' },
    prescription_id: { type: 'bigint', nullable: false },
    product_id: { type: 'bigint', nullable: false },
    product_name: { type: 'nvarchar', length: 150, nullable: false },
    dosage: { type: 'nvarchar', length: 100, nullable: true },
    frequency: { type: 'nvarchar', length: 100, nullable: true },
    duration_days: { type: 'int', nullable: true },
    quantity: { type: 'int', nullable: false },
    usage_note: { type: 'nvarchar', length: 255, nullable: true },
  },
});

module.exports = { PrescriptionEntity, PrescriptionItemEntity };
