// Service bệnh án (MED-01, MED-02, MED-03) + lịch sử bệnh lý phía chủ nuôi (PET-07).
// Logic giữ nguyên bản node-mssql đã giao 28/10, chỉ đổi tầng truy vấn từ SQL thô
// sang TypeORM theo rules.md §3.
// Khớp schema thật dbo.medical_records / dbo.prescriptions / dbo.prescription_items
// (xem docs/schema-assumptions.md mục 10, 11, 12):
// bác sĩ = experts.type='vet' + status='approved'; bệnh án bắt buộc booking_id và
// visit_date (lấy ngày từ bookings.scheduled_at), booking_id UNIQUE (1 bệnh án/booking);
// đơn thuốc dùng version + parent_id + allow_reorder + max_refills, items có
// product_name snapshot và usage_note.
const { AppDataSource } = require('../config/data-source');
const medicalRepository = require('../repositories/medical.repository');
const petRepository = require('../repositories/pet.repository');
const prescriptionRepository = require('../repositories/prescription.repository');
const productRepository = require('../repositories/product.repository');
const ApiError = require('../utils/ApiError');

// Kiểm tra bác sĩ đã được duyệt: dòng dbo.experts với type='vet' và status='approved'.
// Trả về dòng experts (vet.id = experts.id) để service dùng cho vet_id.
async function assertVerifiedVet(userId) {
  const vet = await medicalRepository.findApprovedVetByUserId(userId);
  if (!vet) {
    throw new ApiError(403, 'Chỉ bác sĩ thú y đã được duyệt mới thực hiện được', 'FORBIDDEN');
  }
  return vet;
}

// Chuẩn hóa allow_reorder / max_refills theo CHECK của schema:
// bệnh severe thì allow_reorder=0 và max_refills=0; allow_reorder=0 thì max_refills=0.
function normalizeRefill(severity, allowReorder, maxRefills) {
  if (severity === 'severe') return { allow_reorder: 0, max_refills: 0 };
  const allow = allowReorder ? 1 : 0;
  const max = allow ? Number(maxRefills || 0) : 0;
  if (!Number.isInteger(max) || max < 0 || max > 255) {
    throw new ApiError(400, 'max_refills phải là số nguyên từ 0 đến 255', 'BAD_REQUEST');
  }
  return { allow_reorder: allow, max_refills: max };
}

// Lấy phần ngày (DATE) từ 1 giá trị datetime, theo giờ UTC — dùng cho visit_date
// và so sánh valid_until. Bản cũ lấy CAST(... AS DATE) ở SQL; ở đây cắt ở JS.
function toDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

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

// Kiểm tra quyền sở hữu pet (dùng chung cho PET-07; bản cũ lấy từ petService).
async function assertPetOwner(ownerId, petId) {
  const pet = await petRepository.findById(petId);
  if (!pet) throw new ApiError(404, 'Không tìm thấy thú cưng', 'NOT_FOUND');
  if (Number(pet.owner_id) !== Number(ownerId)) {
    throw new ApiError(403, 'Chỉ chủ sở hữu mới được xem hồ sơ này', 'FORBIDDEN');
  }
  return pet;
}

// MED-01: bác sĩ xem hồ sơ bệnh lý — chỉ khi có lịch hẹn hợp lệ với pet đó
// (booking liên kết vet + pet, chưa bị hủy).
async function vetViewMedicalHistory(vetUserId, petId) {
  const vet = await assertVerifiedVet(vetUserId);
  const count = await medicalRepository.countValidBookings(vet.id, petId);
  if (count === 0) {
    throw new ApiError(403, 'Bác sĩ không có lịch hẹn hợp lệ với thú cưng này', 'FORBIDDEN');
  }
  const records = await medicalRepository.findRecordsByPetId(petId);
  const prescriptions = await prescriptionRepository.findByPetId(petId);
  return { records, prescriptions };
}

// MED-02: bác sĩ tạo hồ sơ khám (chỉ vet đã duyệt).
// Bắt buộc booking_id: booking phải tồn tại, thuộc về vet này và pet này.
// visit_date lấy ngày từ bookings.scheduled_at (fallback ngày hiện tại).
// booking_id UNIQUE nên tạo trùng sẽ trả lỗi rõ ràng.
async function createMedicalRecord(vetUserId, body) {
  const vet = await assertVerifiedVet(vetUserId);
  if (!body.booking_id) {
    throw new ApiError(400, 'Thiếu booking_id (bệnh án phải gắn với 1 lịch hẹn)', 'BAD_REQUEST');
  }
  if (!body.pet_id) throw new ApiError(400, 'Thiếu pet_id', 'BAD_REQUEST');
  const booking = await medicalRepository.findBookingById(body.booking_id);
  if (!booking) throw new ApiError(404, 'Không tìm thấy lịch hẹn', 'NOT_FOUND');
  if (Number(booking.expert_id) !== Number(vet.id)) {
    throw new ApiError(403, 'Lịch hẹn này không thuộc về bác sĩ này', 'FORBIDDEN');
  }
  if (Number(booking.pet_id) !== Number(body.pet_id)) {
    throw new ApiError(403, 'Lịch hẹn này không thuộc về thú cưng này', 'FORBIDDEN');
  }
  const visitDate = toDateOnly(booking.scheduled_at) || toDateOnly(new Date());
  try {
    return await medicalRepository.createRecord({
      pet_id: body.pet_id,
      vet_id: vet.id,
      booking_id: body.booking_id,
      visit_date: visitDate,
      symptoms: body.symptoms || null,
      diagnosis: body.diagnosis || null,
      treatment: body.treatment || null,
      notes: body.notes || null,
    });
  } catch (err) {
    // 2627/2601 = vi phạm UNIQUE (booking_id đã có bệnh án).
    const code = err && err.driverError ? err.driverError.number : err && err.number;
    if (code === 2627 || code === 2601) {
      throw new ApiError(409, 'Lịch hẹn này đã có bệnh án, mỗi booking chỉ có 1 bệnh án', 'CONFLICT');
    }
    throw err;
  }
}

// MED-03: cập nhật ghi chú điều trị. Nếu body có new_prescription thì đồng thời:
// đơn active cũ của bệnh án này chuyển 'superseded', tạo đơn mới (version = max + 1,
// parent_id = đơn cũ có version cao nhất, giữ nguyên medical_record_id).
async function updateMedicalNotes(vetUserId, recordId, body) {
  const vet = await assertVerifiedVet(vetUserId);
  return await AppDataSource.transaction(async (manager) => {
    const record = await medicalRepository.findRecordById(recordId, manager);
    if (!record) throw new ApiError(404, 'Không tìm thấy bệnh án', 'NOT_FOUND');
    if (Number(record.vet_id) !== Number(vet.id)) {
      throw new ApiError(403, 'Chỉ bác sĩ tạo bệnh án mới được cập nhật ghi chú', 'FORBIDDEN');
    }
    const patch = { updated_at: new Date() };
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.diagnosis !== undefined) patch.diagnosis = body.diagnosis;
    if (body.treatment !== undefined) patch.treatment = body.treatment;
    if (body.symptoms !== undefined) patch.symptoms = body.symptoms;
    const updated = await medicalRepository.updateRecord(recordId, patch, manager);

    let newPrescription = null;
    if (body.new_prescription) {
      const np = body.new_prescription;
      const severity = np.severity || 'mild';
      const refill = normalizeRefill(severity, np.allow_reorder, np.max_refills);
      const olds = await prescriptionRepository.findActiveByMedicalRecordId(recordId, manager);
      let parentId = null;
      for (const old of olds) {
        if (parentId === null) parentId = old.id;
        await prescriptionRepository.updatePrescriptionStatus(old.id, 'superseded', manager);
      }
      const maxVersion = await prescriptionRepository.findMaxVersionByMedicalRecordId(
        recordId,
        manager,
      );
      newPrescription = await prescriptionRepository.createPrescription(
        {
          pet_id: record.pet_id,
          vet_id: vet.id,
          medical_record_id: recordId,
          version: maxVersion + 1,
          parent_id: parentId,
          severity,
          status: 'active',
          valid_until: np.valid_until || null,
          allow_reorder: refill.allow_reorder,
          max_refills: refill.max_refills,
          note: np.note || null,
          issued_at: new Date(),
        },
        manager,
      );
      if (Array.isArray(np.items)) {
        await insertPrescriptionItems(manager, newPrescription.id, np.items);
      }
    }
    return { record: updated, new_prescription: newPrescription };
  });
}

// PET-07 (phía chủ nuôi): xem lịch sử bệnh lý + đơn thuốc của pet mình.
async function petMedicalHistory(ownerId, petId) {
  await assertPetOwner(ownerId, petId);
  const records = await medicalRepository.findRecordsByPetId(petId);
  const prescriptions = await medicalRepository.findPetPrescriptionsWithItems(petId);
  return { records, prescriptions };
}

module.exports = {
  assertVerifiedVet,
  normalizeRefill,
  toDateOnly,
  vetViewMedicalHistory,
  createMedicalRecord,
  updateMedicalNotes,
  petMedicalHistory,
};
