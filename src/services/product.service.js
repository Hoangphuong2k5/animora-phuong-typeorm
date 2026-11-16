// Service sản phẩm + danh mục (PRD-01, PRD-02, PRD-03, PRD-04, PRD-05).
// Logic giữ nguyên bản node-mssql đã giao 28/10, chỉ đổi tầng truy vấn từ SQL thô
// sang TypeORM theo rules.md §3: controller -> service (nghiệp vụ + transaction)
// -> repository (TypeORM).
// Khớp schema thật dbo.products / dbo.product_categories / dbo.inventory_batches /
// dbo.audit_logs (xem docs/schema-assumptions.md mục 1, 1b, 2, 3, 18):
// requires_prescription (không phải is_prescription_required), images là JSON array,
// status 'active'/'hidden' (không phải is_active), danh mục KHÔNG có
// description/created_at, audit ghi vào audit_logs.
const { AppDataSource } = require('../config/data-source');
const productRepository = require('../repositories/product.repository');
const petRepository = require('../repositories/pet.repository');
const ApiError = require('../utils/ApiError');

// Chuẩn hóa cột images (NVARCHAR(MAX) + CHECK ISJSON) từ đầu vào:
// nhận array -> stringify; nhận chuỗi JSON -> giữ; nhận 1 URL -> thành [url].
function toImagesJson(body) {
  if (body.images !== undefined && body.images !== null) {
    if (Array.isArray(body.images)) return JSON.stringify(body.images);
    if (typeof body.images === 'string') return body.images;
    return JSON.stringify(body.images);
  }
  if (body.image_url) return JSON.stringify([body.image_url]);
  return null;
}

// Cờ kê đơn: nhận requires_prescription, tương thích ngược is_prescription_required.
function toRequiresRx(body) {
  const v =
    body.requires_prescription !== undefined
      ? body.requires_prescription
      : body.is_prescription_required;
  return v ? 1 : 0;
}

// Trạng thái sản phẩm: nhận status 'active'/'hidden', tương thích ngược is_active.
function toProductStatus(body) {
  if (body.status === 'active' || body.status === 'hidden') return body.status;
  if (body.is_active !== undefined) return body.is_active ? 'active' : 'hidden';
  return null;
}

// Tạo slug SEO từ tên sản phẩm: bỏ dấu tiếng Việt, thay khoảng trắng bằng gạch ngang.
function toSlug(text) {
  return (
    String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/\u0110/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'san-pham'
  );
}

// Đảm bảo slug duy nhất trong dbo.products: nếu trùng thì thêm hậu tố -2, -3...
async function uniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let i = 2;
  for (;;) {
    const existed = await productRepository.findProductBySlug(slug, excludeId);
    if (!existed) return slug;
    slug = `${baseSlug}-${i++}`;
  }
}

// Gắn thêm alias thuận tiện cho FE (giữ nguyên tên cột thật làm chuẩn).
function formatProduct(product) {
  if (!product) return null;
  return {
    ...product,
    is_prescription_required: !!product.requires_prescription,
    is_active: product.status === 'active',
  };
}

// PRD-03: danh sách danh mục (công khai).
const listCategories = async () => {
  return await productRepository.listCategories();
};

// PRD-03: tạo danh mục (admin). Bảng thật chỉ có name, slug, parent_id.
const createCategory = async (body) => {
  if (!body.name) throw new ApiError(400, 'Thiếu tên danh mục', 'BAD_REQUEST');
  const slug = body.slug || toSlug(body.name);
  return await productRepository.createCategory({
    name: body.name,
    slug,
    parent_id: body.parent_id || null,
  });
};

// PRD-03: cập nhật danh mục (admin).
const updateCategory = async (id, body) => {
  const patch = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.slug !== undefined) patch.slug = body.slug;
  if (body.parent_id !== undefined) patch.parent_id = body.parent_id;
  const updated = await productRepository.updateCategory(id, patch);
  if (!updated) throw new ApiError(404, 'Không tìm thấy danh mục', 'NOT_FOUND');
  return updated;
};

// PRD-03: xóa danh mục — CHẶN nếu còn sản phẩm hoặc còn danh mục con.
// Danh mục không có cột status nên xóa cứng như bản cũ (xem PHUONG-CONVERSION.md).
const deleteCategory = async (id) => {
  const inUse =
    (await productRepository.countProductsByCategory(id)) +
    (await productRepository.countChildCategories(id));
  if (inUse > 0) {
    throw new ApiError(
      409,
      'Không thể xóa danh mục đang chứa sản phẩm hoặc danh mục con',
      'CONFLICT',
    );
  }
  const result = await productRepository.deleteCategory(id);
  if (!result || result.affected === 0) {
    throw new ApiError(404, 'Không tìm thấy danh mục', 'NOT_FOUND');
  }
  return { deleted: true, categoryId: Number(id) };
};

// PRD-04: tạo sản phẩm (admin). SKU cho phép NULL; nếu gửi SKU thì app kiểm tra trùng
// (schema có filtered unique index uq_prd_sku cho SKU khác NULL nên DB cũng chặn trùng).
const createProduct = async (body) => {
  if (!body.name) throw new ApiError(400, 'Thiếu tên sản phẩm', 'BAD_REQUEST');
  if (body.price === undefined || body.price === null) {
    throw new ApiError(400, 'Thiếu giá sản phẩm', 'BAD_REQUEST');
  }
  if (!body.category_id) {
    throw new ApiError(400, 'Thiếu category_id (bắt buộc theo schema)', 'BAD_REQUEST');
  }
  if (body.sku) {
    const dup = await productRepository.findProductBySku(body.sku);
    if (dup) throw new ApiError(409, `SKU đã tồn tại: ${body.sku}`, 'CONFLICT');
  }
  const slug = await uniqueSlug(toSlug(body.name));
  const created = await productRepository.createProduct({
    sku: body.sku || null,
    name: body.name,
    slug,
    brand: body.brand || null,
    category_id: body.category_id,
    price: body.price,
    requires_prescription: toRequiresRx(body),
    description: body.description || null,
    images: toImagesJson(body),
    status: toProductStatus(body) || 'active',
  });
  return formatProduct(created);
};

// PRD-05: cập nhật sản phẩm (admin) + ghi audit_logs thật.
const updateProduct = async (adminId, id, body, ipAddress) => {
  const old = await productRepository.findProductById(id);
  if (!old) throw new ApiError(404, 'Không tìm thấy sản phẩm', 'NOT_FOUND');
  if (body.sku && body.sku !== old.sku) {
    const dup = await productRepository.findProductBySku(body.sku, id);
    if (dup) throw new ApiError(409, `SKU đã tồn tại: ${body.sku}`, 'CONFLICT');
  }
  let slug = old.slug;
  if (body.name && body.name !== old.name) {
    slug = await uniqueSlug(toSlug(body.name), id);
  }

  const patch = { slug, updated_at: new Date() };
  if (body.sku !== undefined) patch.sku = body.sku;
  if (body.name !== undefined) patch.name = body.name;
  if (body.brand !== undefined) patch.brand = body.brand;
  if (body.category_id !== undefined) patch.category_id = body.category_id;
  if (body.price !== undefined) patch.price = body.price;
  if (body.requires_prescription !== undefined || body.is_prescription_required !== undefined) {
    patch.requires_prescription = toRequiresRx(body);
  }
  if (body.description !== undefined) patch.description = body.description;
  if (body.images !== undefined || body.image_url !== undefined) {
    patch.images = toImagesJson(body);
  }
  const status = toProductStatus(body);
  if (status) patch.status = status;

  const updated = await productRepository.updateProduct(id, patch);
  // Ghi audit log vào bảng dbo.audit_logs thật (không chặn cập nhật chính nếu lỗi).
  try {
    await petRepository.createAuditLog({
      actor_id: adminId,
      action: 'UPDATE_PRODUCT',
      entity_type: 'product',
      entity_id: id,
      old_values: JSON.stringify(old),
      new_values: JSON.stringify(updated),
      ip_address: ipAddress || null,
    });
  } catch (err) {
    // Bỏ qua lỗi ghi audit log như bản cũ (catch rỗng).
  }
  return formatProduct(updated);
};

// PRD-01: tìm kiếm/lọc/phân trang sản phẩm (chỉ sản phẩm đang active).
const searchProducts = async (queryParams) => {
  const page = parseInt(queryParams.page, 10) || 1;
  const limit = parseInt(queryParams.limit, 10) || parseInt(queryParams.pageSize, 10) || 10;
  const result = await productRepository.searchProducts({
    q: queryParams.q || null,
    category_id: queryParams.category_id ? Number(queryParams.category_id) : null,
    min_price:
      queryParams.min_price !== undefined && queryParams.min_price !== ''
        ? Number(queryParams.min_price)
        : null,
    max_price:
      queryParams.max_price !== undefined && queryParams.max_price !== ''
        ? Number(queryParams.max_price)
        : null,
    sort: queryParams.sort || null,
    page,
    limit: Math.min(limit, 100),
  });
  return {
    items: result.items.map(formatProduct),
    page,
    limit: Math.min(limit, 100),
    totalItems: result.total,
  };
};

// PRD-02: chi tiết sản phẩm + tồn kho khả dụng (join inventory_batches).
const getProductDetail = async (id) => {
  const product = await productRepository.getProductDetailWithStock(id);
  if (!product) throw new ApiError(404, 'Không tìm thấy sản phẩm', 'NOT_FOUND');
  return formatProduct(product);
};

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createProduct,
  updateProduct,
  searchProducts,
  getProductDetail,
  toSlug,
};
