// Service đơn thuốc + mua thuốc theo đơn (MED-04, MED-05, MED-06, MED-07, MED-08).
// (MED-09 đề xuất nhập thuốc nằm ở medicine-suggestion.service.js.)
// Logic giữ nguyên bản node-mssql đã giao 28/10, chỉ đổi tầng truy vấn từ SQL thô
// sang TypeORM theo rules.md §3.
// Khớp schema thật dbo.prescriptions / dbo.prescription_items / dbo.orders /
// dbo.carts / dbo.cart_items (xem docs/schema-assumptions.md mục 11, 12, 13, 14):
// version + parent_id (không phải previous_version_id), max_refills + allow_reorder
// (không có purchase_count/updated_at), items có product_name snapshot + usage_note,
// số lần mua lại đếm qua dbo.orders (không phải purchase_count), giỏ hàng snapshot giá.
const { AppDataSource } = require('../config/data-source');
const prescriptionRepository = require('../repositories/prescription.repository');
const medicalRepository = require('../repositories/medical.repository');
const petRepository = require('../repositories/pet.repository');
const productRepository = require('../repositories/product.repository');
const { assertVerifiedVet, normalizeRefill, toDateOnly } = require('./medical.service');
const ApiError = require('../utils/ApiError');

// Chèn các prescription_items kèm snapshot tên sản phẩm (product_name NOT NULL).
async function insertPrescriptionItems(manager, prescriptionId, items) {
  for (const item of items) {
    const product = await productRepository.findProductById(item.product_id, manager);
    if (!product) {
      throw new ApiError(400, `Sản phẩm không tồn tại: product_id=${item.product_id}`, 'BAD_REQUEST');
    }
    await prescriptionRepository.createItem(
      {
        prescription_id: prescriptionId,
        product_id: item.product_id,
        product_name: product.name,
        quantity: item.quantity,
        dosage: item.dosage || null,
        frequency: item.frequency || null,
        duration_days: item.duration_days ?? null,
        usage_note: item.usage_note || item.note || null,
      },
      manager,
    );
  }
}

// Số lần đơn đã được dùng = số order gắn prescription_id đó và chưa bị hủy/trả.
// (Schema không có cột purchase_count nên đếm qua dbo.orders.)
async function countUsedOrders(manager, prescriptionId) {
  return await prescriptionRepository.countUsedOrders(prescriptionId, manager);
}

// Giới hạn lượt dùng còn lại: allow_reorder=1 thì used < max_refills;
// allow_reorder=0 thì chỉ lượt mua đầu tiên (used phải = 0, đúng "severe: mua 1 lần").
function refillLimitReached(prescription, used) {
  if (prescription.allow_reorder) return used >= Number(prescription.max_refills);
  return used >= 1;
}

// MED-04: bác sĩ kê đơn (chỉ vet đã duyệt). Đơn gắn với 1 bệnh án (medical_record_id
// NOT NULL): bệnh án phải tồn tại, thuộc về vet này và pet này. Items phải là sản
// phẩm có trong Shop (product_id tồn tại).
async function createPrescription(vetUserId, body) {
  const vet = await assertVerifiedVet(vetUserId);
  if (!body.medical_record_id) {
    throw new ApiError(400, 'Thiếu medical_record_id (đơn phải gắn với 1 bệnh án)', 'BAD_REQUEST');
  }
  return await AppDataSource.transaction(async (manager) => {
    const record = await medicalRepository.findRecordById(body.medical_record_id, manager);
    if (!record) throw new ApiError(404, 'Không tìm thấy bệnh án', 'NOT_FOUND');
    if (Number(record.vet_id) !== Number(vet.id)) {
      throw new ApiError(403, 'Bệnh án này không thuộc về bác sĩ này', 'FORBIDDEN');
    }
    const petId = body.pet_id || record.pet_id;
    if (body.pet_id && Number(body.pet_id) !== Number(record.pet_id)) {
      throw new ApiError(403, 'pet_id không khớp với bệnh án', 'FORBIDDEN');
    }
    const severity = body.severity || 'mild';
    const refill = normalizeRefill(severity, body.allow_reorder, body.max_refills);
    const prescription = await prescriptionRepository.createPrescription(
      {
        pet_id: petId,
        vet_id: vet.id,
        medical_record_id: body.medical_record_id,
        version: 1,
        parent_id: null,
        severity,
        status: 'active',
        valid_until: body.valid_until || null,
        allow_reorder: refill.allow_reorder,
        max_refills: refill.max_refills,
        note: body.note || null,
        issued_at: new Date(),
      },
      manager,
    );
    if (Array.isArray(body.items)) {
      await insertPrescriptionItems(manager, prescription.id, body.items);
    }
    return prescription;
  });
}

// MED-05: cập nhật đơn thuốc = tạo phiên bản mới, đơn cũ chuyển 'superseded'.
// Version mới = version cũ + 1, parent_id = id đơn cũ, giữ nguyên medical_record_id
// (UNIQUE theo cặp medical_record_id + version).
async function updatePrescriptionVersion(vetUserId, prescriptionId, body) {
  const vet = await assertVerifiedVet(vetUserId);
  return await AppDataSource.transaction(async (manager) => {
    const old = await prescriptionRepository.findById(prescriptionId, manager);
    if (!old) throw new ApiError(404, 'Không tìm thấy đơn thuốc', 'NOT_FOUND');
    if (old.status !== 'active') {
      throw new ApiError(409, 'Chỉ cập nhật được đơn thuốc đang active', 'CONFLICT');
    }
    if (Number(old.vet_id) !== Number(vet.id)) {
      throw new ApiError(403, 'Chỉ bác sĩ kê đơn mới được cập nhật đơn này', 'FORBIDDEN');
    }
    await prescriptionRepository.updatePrescriptionStatus(prescriptionId, 'superseded', manager);
    const severity = body.severity || old.severity;
    const refill = normalizeRefill(
      severity,
      body.allow_reorder !== undefined ? body.allow_reorder : old.allow_reorder,
      body.max_refills !== undefined ? body.max_refills : old.max_refills,
    );
    const next = await prescriptionRepository.createPrescription(
      {
        pet_id: old.pet_id,
        vet_id: vet.id,
        medical_record_id: old.medical_record_id,
        version: Number(old.version) + 1,
        parent_id: prescriptionId,
        severity,
        status: 'active',
        valid_until: body.valid_until || old.valid_until,
        allow_reorder: refill.allow_reorder,
        max_refills: refill.max_refills,
        note: body.note !== undefined ? body.note : old.note,
        issued_at: new Date(),
      },
      manager,
    );
    // Sao chép items cũ, cho phép ghi đè bằng items mới nếu body có items.
    if (Array.isArray(body.items)) {
      await insertPrescriptionItems(manager, next.id, body.items);
    } else {
      await prescriptionRepository.copyItems(prescriptionId, next.id, manager);
    }
    return next;
  });
}

// MED-06: xem lịch sử đơn thuốc.
// KH chỉ xem đơn của pet mình; BS (expert + vet approved) xem đơn mình kê hoặc pet
// mình từng tạo bệnh án; admin xem tất cả.
async function listPrescriptionHistory(user, queryParams) {
  const page = parseInt(queryParams.page, 10) || 1;
  const limit = parseInt(queryParams.limit, 10) || parseInt(queryParams.pageSize, 10) || 10;
  let scope = null;
  let vetId = null;
  if (user.role === 'customer') {
    scope = 'customer';
  } else if (user.role === 'expert') {
    const vet = await assertVerifiedVet(user.id);
    scope = 'expert';
    vetId = vet.id;
  } else if (user.role === 'admin') {
    scope = 'admin';
  } else {
    throw new ApiError(403, 'Không có quyền xem lịch sử đơn thuốc', 'FORBIDDEN');
  }
  const result = await prescriptionRepository.listPrescriptionHistory({
    pet_id: queryParams.pet_id ? Number(queryParams.pet_id) : null,
    status: queryParams.status || null,
    scope,
    userId: user.id,
    vetId,
    page,
    limit: Math.min(limit, 100),
  });
  return {
    items: result.items,
    page,
    limit: Math.min(limit, 100),
    totalItems: result.total,
  };
}

// MED-07 (BR-MED-08): kiểm tra điều kiện mua thuốc theo đơn.
// Body: { items: [{ product_id, quantity }], prescription_id? }
// - Giỏ không có thuốc kê đơn -> hợp lệ.
// - Có thuốc kê đơn -> bắt buộc prescription_id: đơn phải active, chưa quá hạn,
//   chưa vượt giới hạn lượt dùng (đếm qua orders), và các thuốc kê đơn phải nằm
//   trong đơn đó.
// Hàm này trả về { valid, errors } (HTTP 200) như bản cũ, không ném lỗi nghiệp vụ.
async function validatePurchase(user, body) {
  const items = Array.isArray(body.items) ? body.items : [];
  const errors = [];
  if (items.length === 0) return { valid: true, errors };

  // Lấy cờ kê đơn của từng sản phẩm trong giỏ.
  const requiredIds = [];
  for (const item of items) {
    const product = await productRepository.findProductById(item.product_id);
    if (!product) {
      errors.push(`Sản phẩm không tồn tại: product_id=${item.product_id}`);
    } else if (product.requires_prescription) {
      requiredIds.push(item.product_id);
    }
  }
  if (errors.length) return { valid: false, errors };
  if (requiredIds.length === 0) return { valid: true, errors };
  if (!body.prescription_id) {
    return {
      valid: false,
      errors: ['Giỏ hàng có thuốc kê đơn, bắt buộc phải có đơn thuốc của bác sĩ (prescription_id)'],
    };
  }
  const prescription = await prescriptionRepository.findById(body.prescription_id);
  if (!prescription) {
    return { valid: false, errors: ['Đơn thuốc không tồn tại'] };
  }
  // Đơn phải thuộc về pet của chính khách này.
  const pet = await petRepository.findById(prescription.pet_id);
  if (!pet || Number(pet.owner_id) !== Number(user.id)) {
    return { valid: false, errors: ['Đơn thuốc không thuộc về bạn'] };
  }
  if (prescription.status !== 'active') {
    errors.push(`Đơn thuốc không còn hiệu lực (status=${prescription.status})`);
  }
  if (prescription.valid_until && toDateOnly(prescription.valid_until) < toDateOnly(new Date())) {
    errors.push('Đơn thuốc đã quá hạn dùng');
  }
  const used = await countUsedOrders(null, prescription.id);
  if (refillLimitReached(prescription, used)) {
    errors.push('Đơn thuốc đã vượt số lần mua cho phép');
  }
  const covered = await prescriptionRepository.findItemsByPrescriptionId(prescription.id);
  const coveredSet = new Set(covered.map((x) => Number(x.product_id)));
  for (const pid of requiredIds) {
    if (!coveredSet.has(Number(pid))) {
      errors.push(`Thuốc kê đơn product_id=${pid} không nằm trong đơn thuốc đã chọn`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// MED-08: mua lại đơn thuốc (chỉ bệnh nhẹ).
// Điều kiện: severity == 'mild', allow_reorder = 1, đơn active, chưa quá hạn,
// số lần đã dùng (đếm qua orders) < max_refills.
// Thêm các prescription_items vào giỏ của khách (tạo giỏ nếu chưa có), trùng sản
// phẩm thì cộng dồn quantity (UNIQUE cart_id + product_id), giá snapshot từ
// products.price. Reorder KHÔNG tự tiêu thụ lượt mua: lượt chỉ tính khi có order.
async function reorderPrescription(user, prescriptionId) {
  return await AppDataSource.transaction(async (manager) => {
    const prescription = await prescriptionRepository.findById(prescriptionId, manager);
    if (!prescription) throw new ApiError(404, 'Không tìm thấy đơn thuốc', 'NOT_FOUND');
    const pet = await petRepository.findById(prescription.pet_id, manager);
    if (!pet || Number(pet.owner_id) !== Number(user.id)) {
      throw new ApiError(403, 'Đơn thuốc không thuộc về bạn', 'FORBIDDEN');
    }
    if (prescription.severity !== 'mild') {
      throw new ApiError(409, 'Chỉ mua lại được đơn thuốc bệnh nhẹ (mild)', 'CONFLICT');
    }
    if (!prescription.allow_reorder) {
      throw new ApiError(409, 'Đơn thuốc này không cho phép mua lại', 'CONFLICT');
    }
    if (prescription.status !== 'active') {
      throw new ApiError(409, `Đơn thuốc không còn hiệu lực (status=${prescription.status})`, 'CONFLICT');
    }
    if (prescription.valid_until && toDateOnly(prescription.valid_until) < toDateOnly(new Date())) {
      throw new ApiError(409, 'Đơn thuốc đã quá hạn dùng', 'CONFLICT');
    }
    const used = await countUsedOrders(manager, prescriptionId);
    if (refillLimitReached(prescription, used)) {
      throw new ApiError(409, 'Đơn thuốc đã vượt số lần mua lại cho phép', 'CONFLICT');
    }
    const items = await prescriptionRepository.findItemsByPrescriptionId(prescriptionId, manager);
    if (items.length === 0) {
      throw new ApiError(409, 'Đơn thuốc không có sản phẩm nào', 'CONFLICT');
    }
    // Lấy hoặc tạo giỏ của khách.
    let cart = await prescriptionRepository.findCartByCustomerId(user.id, manager);
    let cartId;
    if (cart) {
      cartId = cart.id;
    } else {
      cart = await prescriptionRepository.createCart(user.id, manager);
      cartId = cart.id;
    }
    for (const item of items) {
      const product = await productRepository.findProductById(item.product_id, manager);
      if (!product) {
        throw new ApiError(400, `Sản phẩm không tồn tại: product_id=${item.product_id}`, 'BAD_REQUEST');
      }
      const existing = await prescriptionRepository.findCartItem(cartId, item.product_id, manager);
      if (existing) {
        await prescriptionRepository.updateCartItemQuantity(
          existing.id,
          Number(existing.quantity) + Number(item.quantity),
          manager,
        );
      } else {
        await prescriptionRepository.createCartItem(
          cartId,
          item.product_id,
          item.quantity,
          product.price,
          manager,
        );
      }
    }
    return { cart_id: cartId, added_items: items.length };
  });
}

module.exports = {
  createPrescription,
  updatePrescriptionVersion,
  listPrescriptionHistory,
  validatePurchase,
  reorderPrescription,
  countUsedOrders,
  refillLimitReached,
};
