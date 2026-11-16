// Tầng truy vấn CSDL cho products / product_categories / inventory_batches.
// Chỉ làm việc với TypeORM DataSource, theo đúng mẫu repositories trong rules.md §7.2:
// nhận `manager` khi service chạy trong transaction, nếu không dùng AppDataSource.
//
// Riêng tồn kho khả dụng (PRD-02) dùng raw SQL vì cần JOIN inventory_batches
// (bảng của Hoàng, inventory.*) + hàm tổng — giữ nguyên câu SQL bản node-mssql cũ.
const { In } = require('typeorm');
const { AppDataSource } = require('../config/data-source');
const { ProductEntity, ProductCategoryEntity } = require('../entities/product.entity');

const getProductRepo = (manager) =>
  manager ? manager.getRepository(ProductEntity) : AppDataSource.getRepository(ProductEntity);
const getCategoryRepo = (manager) =>
  manager
    ? manager.getRepository(ProductCategoryEntity)
    : AppDataSource.getRepository(ProductCategoryEntity);

// ---- Danh mục (PRD-03) ----

const listCategories = async (manager = null) => {
  return await getCategoryRepo(manager).find({
    order: { parent_id: 'ASC', name: 'ASC' },
  });
};

const findCategoryById = async (id, manager = null) => {
  return await getCategoryRepo(manager).findOne({ where: { id } });
};

const createCategory = async (categoryData, manager = null) => {
  const repo = getCategoryRepo(manager);
  const row = repo.create(categoryData);
  return await repo.save(row);
};

const updateCategory = async (id, categoryData, manager = null) => {
  const repo = getCategoryRepo(manager);
  await repo.update({ id }, categoryData);
  return await findCategoryById(id, manager);
};

// Danh mục KHÔNG có cột status nên không xóa mềm được (xem PHUONG-CONVERSION.md).
// Chỉ xóa cứng khi không còn sản phẩm và không còn danh mục con (service kiểm tra trước).
const deleteCategory = async (id, manager = null) => {
  return await getCategoryRepo(manager).delete({ id });
};

const countProductsByCategory = async (categoryId, manager = null) => {
  return await getProductRepo(manager).count({ where: { category_id: categoryId } });
};

const countChildCategories = async (categoryId, manager = null) => {
  return await getCategoryRepo(manager).count({ where: { parent_id: categoryId } });
};

// ---- Sản phẩm (PRD-01, PRD-02, PRD-04, PRD-05) ----

const findProductById = async (id, manager = null) => {
  return await getProductRepo(manager).findOne({ where: { id } });
};

const findProductBySlug = async (slug, excludeId = null, manager = null) => {
  const qb = getProductRepo(manager)
    .createQueryBuilder('p')
    .where('p.slug = :slug', { slug });
  if (excludeId !== null && excludeId !== undefined) {
    qb.andWhere('p.id != :excludeId', { excludeId });
  }
  return await qb.getOne();
};

const findProductBySku = async (sku, excludeId = null, manager = null) => {
  const qb = getProductRepo(manager)
    .createQueryBuilder('p')
    .where('p.sku = :sku', { sku });
  if (excludeId !== null && excludeId !== undefined) {
    qb.andWhere('p.id != :excludeId', { excludeId });
  }
  return await qb.getOne();
};

const createProduct = async (productData, manager = null) => {
  const repo = getProductRepo(manager);
  const row = repo.create(productData);
  return await repo.save(row);
};

const updateProduct = async (id, productData, manager = null) => {
  const repo = getProductRepo(manager);
  await repo.update({ id }, productData);
  return await findProductById(id, manager);
};

// PRD-01: tìm kiếm/lọc/phân trang sản phẩm (chỉ sản phẩm đang active).
// Trả kèm category_name cho từng sản phẩm như bản cũ.
const searchProducts = async ({ q, category_id, min_price, max_price, sort, page, limit }) => {
  const repo = getProductRepo();
  const qb = repo.createQueryBuilder('p').where('p.status = :status', { status: 'active' });

  if (q) {
    qb.andWhere('(p.name LIKE :q OR p.description LIKE :q)', { q: `%${q}%` });
  }
  if (category_id) {
    qb.andWhere('p.category_id = :category_id', { category_id });
  }
  if (min_price !== null && min_price !== undefined) {
    qb.andWhere('p.price >= :min_price', { min_price });
  }
  if (max_price !== null && max_price !== undefined) {
    qb.andWhere('p.price <= :max_price', { max_price });
  }

  if (sort === 'price_asc') qb.orderBy('p.price', 'ASC');
  else if (sort === 'price_desc') qb.orderBy('p.price', 'DESC');
  else qb.orderBy('p.created_at', 'DESC');

  qb.skip((page - 1) * limit).take(limit);
  const [items, total] = await qb.getManyAndCount();

  const catIds = [...new Set(items.map((p) => p.category_id).filter((x) => x !== null && x !== undefined))];
  let catMap = {};
  if (catIds.length > 0) {
    const cats = await getCategoryRepo().find({ where: { id: In(catIds) } });
    catMap = Object.fromEntries(cats.map((c) => [Number(c.id), c.name]));
  }
  const withCategory = items.map((p) => ({
    ...p,
    category_name: catMap[Number(p.category_id)] || null,
  }));
  return { items: withCategory, total };
};

// PRD-02: chi tiết sản phẩm + tồn kho khả dụng (join inventory_batches).
// Tồn khả dụng: status='available' và (expiry_date IS NULL hoặc >= hôm nay).
const getProductDetailWithStock = async (id) => {
  const rows = await AppDataSource.query(
    `SELECT p.*, c.name AS category_name,
       (SELECT COALESCE(SUM(b.quantity), 0) FROM dbo.inventory_batches b
         WHERE b.product_id = p.id AND b.status = 'available'
           AND (b.expiry_date IS NULL OR b.expiry_date >= CAST(SYSUTCDATETIME() AS DATE))) AS stock_available
     FROM dbo.products p
     LEFT JOIN dbo.product_categories c ON c.id = p.category_id
     WHERE p.id = @0`,
    [Number(id)],
  );
  return rows[0] || null;
};

module.exports = {
  listCategories,
  findCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  countProductsByCategory,
  countChildCategories,
  findProductById,
  findProductBySlug,
  findProductBySku,
  createProduct,
  updateProduct,
  searchProducts,
  getProductDetailWithStock,
};
