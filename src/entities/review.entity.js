// Entity đánh giá chuyên viên, theo đúng schema thật dbo.expert_reviews
// (animora-sqlserver-v0_1.sql v1.6, xem docs/schema-assumptions.md mục 8):
//  - UNIQUE(booking_id): 1 booking chỉ review 1 lần;
//  - rating là TINYINT (1-5); status mặc định 'approved';
//  - điểm chuyên viên tính lại vào experts.rating + rating_count
//    (KHÔNG phải rating_avg), chỉ tính review status='approved'.
const { EntitySchema } = require('typeorm');

const ReviewEntity = new EntitySchema({
  name: 'Review',
  tableName: 'expert_reviews',
  columns: {
    id: { type: 'bigint', primary: true, generated: 'increment' },
    booking_id: { type: 'bigint', nullable: false },
    expert_id: { type: 'bigint', nullable: false },
    customer_id: { type: 'bigint', nullable: false },
    rating: { type: 'tinyint', nullable: false },
    comment: { type: 'nvarchar', length: 'MAX', nullable: true },
    status: { type: 'nvarchar', length: 20, default: 'approved' }, // approved, hidden
    created_at: { type: 'datetime2', precision: 0, createDate: true },
  },
});

module.exports = { ReviewEntity };
