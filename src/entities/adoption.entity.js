// Entity nhận nuôi, theo đúng schema thật dbo.adoption_posts /
// dbo.adoption_applications (animora-sqlserver-v0_1.sql v1.6, xem
// docs/schema-assumptions.md mục 15, 16):
//  - adoption_applications KHÔNG có shelter_id: trạm sở hữu đơn xác định qua
//    JOIN adoption_posts.shelter_id (shelter_id tham chiếu users.id);
//  - applicant là `customer_id` (KHÔNG phải applicant_id);
//  - KHÔNG có reject_reason, decided_at, handover_at;
//  - trạng thái đơn chỉ pending/approved/rejected/withdrawn (KHÔNG có handed_over);
//  - bàn giao dùng 2 timestamp handover_shelter_at và handover_customer_at;
//    khi cả hai đều có thì adoption_posts.status = 'adopted'
//    (status tin chỉ có published/adopted/removed);
//  - pets KHÔNG có adoption_application_id nên ADP-11 không lưu liên kết pet<->đơn
//    (xem PHUONG-CONVERSION.md, mục "2 điểm schema nhóm chưa quyết").
const { EntitySchema } = require('typeorm');

const AdoptionPostEntity = new EntitySchema({
  name: 'AdoptionPost',
  tableName: 'adoption_posts',
  columns: {
    id: { type: 'bigint', primary: true, generated: 'increment' },
    shelter_id: { type: 'bigint', nullable: false },
    pet_name: { type: 'nvarchar', length: 100, nullable: false },
    species: { type: 'nvarchar', length: 20, nullable: false }, // dog, cat, bird, rabbit, other
    breed: { type: 'nvarchar', length: 100, nullable: true },
    age_months: { type: 'int', nullable: true },
    gender: { type: 'nvarchar', length: 20, default: 'unknown' }, // male, female, unknown
    description: { type: 'nvarchar', length: 'MAX', nullable: true },
    images: { type: 'nvarchar', length: 'MAX', nullable: true }, // JSON array
    health_status: { type: 'nvarchar', length: 255, nullable: true },
    status: { type: 'nvarchar', length: 20, default: 'published' }, // published, adopted, removed
    removed_by: { type: 'bigint', nullable: true },
    removed_reason: { type: 'nvarchar', length: 255, nullable: true },
    created_at: { type: 'datetime2', precision: 0, createDate: true },
    updated_at: { type: 'datetime2', precision: 0, updateDate: true },
  },
});

const AdoptionApplicationEntity = new EntitySchema({
  name: 'AdoptionApplication',
  tableName: 'adoption_applications',
  columns: {
    id: { type: 'bigint', primary: true, generated: 'increment' },
    post_id: { type: 'bigint', nullable: false },
    customer_id: { type: 'bigint', nullable: false },
    housing: { type: 'nvarchar', length: 255, nullable: true },
    experience: { type: 'nvarchar', length: 'MAX', nullable: true },
    reason: { type: 'nvarchar', length: 'MAX', nullable: true },
    status: { type: 'nvarchar', length: 20, default: 'pending' }, // pending, approved, rejected, withdrawn
    handover_shelter_at: { type: 'datetime2', precision: 0, nullable: true },
    handover_customer_at: { type: 'datetime2', precision: 0, nullable: true },
    created_at: { type: 'datetime2', precision: 0, createDate: true },
  },
});

module.exports = { AdoptionPostEntity, AdoptionApplicationEntity };
