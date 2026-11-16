// Tầng truy vấn CSDL cho prescriptions / prescription_items / orders / carts.
// Chỉ làm việc với TypeORM DataSource, theo đúng mẫu repositories trong rules.md §7.2.
//
// Các bảng thuộc phần của Toàn (orders, carts, cart_items) chỉ đọc/ghi bằng
// raw SQL qua manager, không tự định nghĩa entity để tránh đụng khi file
// order.entity.js / cart của Toàn được thêm vào.
// Raw SQL TypeORM cho mssql dùng tham số vị trí @0, @1, ...
const { AppDataSource } = require('../config/data-source');
const { PrescriptionEntity, PrescriptionItemEntity } = require('../entities/prescription.entity');

const getPrescriptionRepo = (manager) =>
  manager
    ? manager.getRepository(PrescriptionEntity)
    : AppDataSource.getRepository(PrescriptionEntity);
const getItemRepo = (manager) =>
  manager
    ? manager.getRepository(PrescriptionItemEntity)
    : AppDataSource.getRepository(PrescriptionItemEntity);

const findById = async (id, manager = null) => {
  return await getPrescriptionRepo(manager).findOne({ where: { id } });
};

const findByPetId = async (petId, manager = null) => {
  return await getPrescriptionRepo(manager).find({
    where: { pet_id: petId },
    order: { created_at: 'DESC' },
  });
};

const createPrescription = async (prescriptionData, manager = null) => {
  const repo = getPrescriptionRepo(manager);
  const row = repo.create(prescriptionData);
  return await repo.save(row);
};

const updatePrescriptionStatus = async (id, status, manager = null) => {
  const repo = getPrescriptionRepo(manager);
  await repo.update({ id }, { status });
  return await findById(id, manager);
};

// Các đơn đang active của 1 bệnh án, version cao nhất trước (phục vụ MED-03/MED-05).
const findActiveByMedicalRecordId = async (medicalRecordId, manager = null) => {
  return await getPrescriptionRepo(manager).find({
    where: { medical_record_id: medicalRecordId, status: 'active' },
    order: { version: 'DESC' },
  });
};

const findMaxVersionByMedicalRecordId = async (medicalRecordId, manager = null) => {
  const row = await getPrescriptionRepo(manager)
    .createQueryBuilder('pr')
    .select('COALESCE(MAX(pr.version), 0)', 'v')
    .where('pr.medical_record_id = :medical_record_id', { medical_record_id: medicalRecordId })
    .getRawOne();
  return Number(row ? row.v : 0);
};

// ---- prescription_items ----

const findItemsByPrescriptionId = async (prescriptionId, manager = null) => {
  return await getItemRepo(manager).find({
    where: { prescription_id: prescriptionId },
  });
};

const createItem = async (itemData, manager = null) => {
  const repo = getItemRepo(manager);
  const row = repo.create(itemData);
  return await repo.save(row);
};

// MED-05: sao chép items của đơn cũ sang đơn mới (giữ nguyên câu SQL bản cũ).
const copyItems = async (oldId, newId, manager) => {
  const db = manager || AppDataSource;
  await db.query(
    `INSERT INTO dbo.prescription_items
       (prescription_id, product_id, product_name, quantity, dosage, frequency, duration_days, usage_note)
     SELECT @0, product_id, product_name, quantity, dosage, frequency, duration_days, usage_note
     FROM dbo.prescription_items WHERE prescription_id = @1`,
    [Number(newId), Number(oldId)],
  );
};

// ---- MED-06: lịch sử đơn thuốc (phân trang, lọc theo pet/status + phân quyền) ----

const listPrescriptionHistory = async ({ pet_id, status, scope, userId, vetId, page, limit }) => {
  const repo = getPrescriptionRepo();
  const qb = repo.createQueryBuilder('pr');

  if (pet_id) {
    qb.andWhere('pr.pet_id = :pet_id', { pet_id });
  }
  if (status) {
    qb.andWhere('pr.status = :status', { status });
  }
  if (scope === 'customer') {
    qb.andWhere('pr.pet_id IN (SELECT id FROM dbo.pets WHERE owner_id = :userId)', { userId });
  } else if (scope === 'expert') {
    qb.andWhere(
      '(pr.vet_id = :vetId OR pr.pet_id IN (SELECT pet_id FROM dbo.medical_records WHERE vet_id = :vetId))',
      { vetId },
    );
  }
  // scope 'admin': không lọc thêm.

  qb.orderBy('pr.created_at', 'DESC');
  qb.skip((page - 1) * limit).take(limit);
  const [items, total] = await qb.getManyAndCount();
  return { items, total };
};

// ---- MED-07 / MED-08: đếm lượt dùng đơn (qua dbo.orders, phần của Toàn) ----
// Số lần đơn đã được dùng = số order gắn prescription_id đó và chưa bị hủy/trả.
// Schema không có cột purchase_count nên phải đếm qua orders.
const countUsedOrders = async (prescriptionId, manager = null) => {
  const db = manager || AppDataSource;
  const rows = await db.query(
    `SELECT COUNT(*) AS c FROM dbo.orders
     WHERE prescription_id = @0 AND [status] NOT IN ('cancelled', 'returned')`,
    [Number(prescriptionId)],
  );
  return Number(rows[0].c);
};

// ---- MED-08: giỏ hàng (bảng carts / cart_items của Toàn, chỉ dùng raw SQL) ----

const findCartByCustomerId = async (customerId, manager) => {
  const db = manager || AppDataSource;
  const rows = await db.query(`SELECT * FROM dbo.carts WHERE customer_id = @0`, [
    Number(customerId),
  ]);
  return rows[0] || null;
};

const createCart = async (customerId, manager) => {
  const db = manager || AppDataSource;
  const rows = await db.query(
    `INSERT INTO dbo.carts (customer_id) OUTPUT INSERTED.* VALUES (@0)`,
    [Number(customerId)],
  );
  return rows[0];
};

const findCartItem = async (cartId, productId, manager) => {
  const db = manager || AppDataSource;
  const rows = await db.query(
    `SELECT * FROM dbo.cart_items WHERE cart_id = @0 AND product_id = @1`,
    [Number(cartId), Number(productId)],
  );
  return rows[0] || null;
};

const updateCartItemQuantity = async (cartItemId, quantity, manager) => {
  const db = manager || AppDataSource;
  await db.query(`UPDATE dbo.cart_items SET quantity = @1 WHERE id = @0`, [
    Number(cartItemId),
    Number(quantity),
  ]);
};

const createCartItem = async (cartId, productId, quantity, price, manager) => {
  const db = manager || AppDataSource;
  await db.query(
    `INSERT INTO dbo.cart_items (cart_id, product_id, quantity, price)
     VALUES (@0, @1, @2, @3)`,
    [Number(cartId), Number(productId), Number(quantity), Number(price)],
  );
};

module.exports = {
  findById,
  findByPetId,
  createPrescription,
  updatePrescriptionStatus,
  findActiveByMedicalRecordId,
  findMaxVersionByMedicalRecordId,
  findItemsByPrescriptionId,
  createItem,
  copyItems,
  listPrescriptionHistory,
  countUsedOrders,
  findCartByCustomerId,
  createCart,
  findCartItem,
  updateCartItemQuantity,
  createCartItem,
};
