// Entity sản phẩm + danh mục, theo đúng schema thật dbo.products /
// dbo.product_categories (animora-sqlserver-v0_1.sql v1.6).
// Lưu ý khớp schema (xem docs/schema-assumptions.md mục 1, 1b, 2):
//  - cờ kê đơn là `requires_prescription` (BIT), KHÔNG phải `is_prescription_required`;
//  - trạng thái là `status` ('active'/'hidden'), KHÔNG phải `is_active`;
//  - `images` là JSON array; danh mục KHÔNG có description/created_at;
//  - sku cho phép NULL (DB có filtered unique index uq_prd_sku, chỉ chặn trùng
//    khi sku khác NULL) — app vẫn kiểm tra trùng trước để trả lỗi đẹp (PRD-04/05).
const { EntitySchema } = require('typeorm');

const ProductCategoryEntity = new EntitySchema({
  name: 'ProductCategory',
  tableName: 'product_categories',
  columns: {
    id: { type: 'bigint', primary: true, generated: 'increment' },
    name: { type: 'nvarchar', length: 100, nullable: false },
    slug: { type: 'nvarchar', length: 100, nullable: false },
    parent_id: { type: 'bigint', nullable: true },
  },
});

const ProductEntity = new EntitySchema({
  name: 'Product',
  tableName: 'products',
  columns: {
    id: { type: 'bigint', primary: true, generated: 'increment' },
    sku: { type: 'nvarchar', length: 50, nullable: true },
    name: { type: 'nvarchar', length: 150, nullable: false },
    slug: { type: 'nvarchar', length: 150, nullable: false },
    brand: { type: 'nvarchar', length: 100, nullable: true },
    category_id: { type: 'bigint', nullable: false },
    description: { type: 'nvarchar', length: 'MAX', nullable: true },
    price: { type: 'decimal', precision: 15, scale: 2, nullable: false },
    images: { type: 'nvarchar', length: 'MAX', nullable: true }, // JSON array
    requires_prescription: { type: 'bit', default: false },
    status: { type: 'nvarchar', length: 20, default: 'active' }, // active, hidden
    rating: { type: 'decimal', precision: 2, scale: 1, default: 0 },
    rating_count: { type: 'int', default: 0 },
    created_at: { type: 'datetime2', precision: 0, createDate: true },
    updated_at: { type: 'datetime2', precision: 0, updateDate: true },
  },
});

module.exports = { ProductEntity, ProductCategoryEntity };
