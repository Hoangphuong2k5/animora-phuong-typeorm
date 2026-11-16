// Entity bệnh án thú y, theo đúng schema thật dbo.medical_records
// (animora-sqlserver-v0_1.sql v1.6, xem docs/schema-assumptions.md mục 10):
//  - vet_id là experts.id (bác sĩ), KHÔNG phải users.id;
//  - booking_id UNIQUE (1 bệnh án/booking), visit_date bắt buộc;
//  - có symptoms; không có cột nào khác ngoài các cột dưới đây.
const { EntitySchema } = require('typeorm');

const MedicalRecordEntity = new EntitySchema({
  name: 'MedicalRecord',
  tableName: 'medical_records',
  columns: {
    id: { type: 'bigint', primary: true, generated: 'increment' },
    pet_id: { type: 'bigint', nullable: false },
    vet_id: { type: 'bigint', nullable: false },
    booking_id: { type: 'bigint', nullable: false },
    visit_date: { type: 'date', nullable: false },
    symptoms: { type: 'nvarchar', length: 'MAX', nullable: true },
    diagnosis: { type: 'nvarchar', length: 'MAX', nullable: true },
    treatment: { type: 'nvarchar', length: 'MAX', nullable: true },
    notes: { type: 'nvarchar', length: 'MAX', nullable: true },
    created_at: { type: 'datetime2', precision: 0, createDate: true },
    updated_at: { type: 'datetime2', precision: 0, updateDate: true },
  },
});

module.exports = { MedicalRecordEntity };
