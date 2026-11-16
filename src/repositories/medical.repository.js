// Tầng truy vấn CSDL cho medical_records (MED-01, MED-02, MED-03, PET-07).
// Chỉ làm việc với TypeORM DataSource, theo đúng mẫu repositories trong rules.md §7.2.
//
// Các bảng thuộc phần người khác (experts của Hoàng, bookings của Toàn) chỉ
// đọc bằng raw SQL qua AppDataSource/manager, không tự định nghĩa entity để
// tránh đụng khi file expert.entity.js / booking.entity.js của họ được thêm vào.
// Raw SQL TypeORM cho mssql dùng tham số vị trí @0, @1, ...
const { AppDataSource } = require('../config/data-source');
const { MedicalRecordEntity } = require('../entities/medical.entity');

const getRecordRepo = (manager) =>
  manager
    ? manager.getRepository(MedicalRecordEntity)
    : AppDataSource.getRepository(MedicalRecordEntity);

const findRecordById = async (id, manager = null) => {
  return await getRecordRepo(manager).findOne({ where: { id } });
};

const findRecordsByPetId = async (petId, manager = null) => {
  return await getRecordRepo(manager).find({
    where: { pet_id: petId },
    order: { created_at: 'DESC' },
  });
};

const createRecord = async (recordData, manager = null) => {
  const repo = getRecordRepo(manager);
  const row = repo.create(recordData);
  return await repo.save(row);
};

const updateRecord = async (id, recordData, manager = null) => {
  const repo = getRecordRepo(manager);
  await repo.update({ id }, recordData);
  return await findRecordById(id, manager);
};

// Kiểm tra bác sĩ đã được duyệt: dòng dbo.experts với type='vet' và status='approved'.
const findApprovedVetByUserId = async (userId, manager = null) => {
  const db = manager || AppDataSource;
  const rows = await db.query(
    `SELECT * FROM dbo.experts
     WHERE user_id = @0 AND [type] = 'vet' AND [status] = 'approved'`,
    [Number(userId)],
  );
  return rows[0] || null;
};

// Đọc 1 booking (phục vụ MED-02: kiểm tra booking thuộc về vet/pet nào).
const findBookingById = async (bookingId, manager = null) => {
  const db = manager || AppDataSource;
  const rows = await db.query(`SELECT * FROM dbo.bookings WHERE id = @0`, [Number(bookingId)]);
  return rows[0] || null;
};

// MED-01: bác sĩ có lịch hẹn hợp lệ với pet không (booking chưa bị hủy).
const countValidBookings = async (expertId, petId, manager = null) => {
  const db = manager || AppDataSource;
  const rows = await db.query(
    `SELECT COUNT(*) AS c FROM dbo.bookings
     WHERE expert_id = @0 AND pet_id = @1 AND status <> 'cancelled'`,
    [Number(expertId), Number(petId)],
  );
  return Number(rows[0].c);
};

// PET-07: đơn thuốc của pet kèm từng dòng thuốc (giữ nguyên dạng trả về
// không chuẩn hóa của bản cũ: 1 dòng kết quả cho mỗi prescription_item).
const findPetPrescriptionsWithItems = async (petId, manager = null) => {
  const db = manager || AppDataSource;
  return await db.query(
    `SELECT pr.*, pi.product_id, pi.quantity, pi.dosage, pi.usage_note AS item_note
     FROM dbo.prescriptions pr
     LEFT JOIN dbo.prescription_items pi ON pi.prescription_id = pr.id
     WHERE pr.pet_id = @0 ORDER BY pr.created_at DESC`,
    [Number(petId)],
  );
};

module.exports = {
  findRecordById,
  findRecordsByPetId,
  createRecord,
  updateRecord,
  findApprovedVetByUserId,
  findBookingById,
  countValidBookings,
  findPetPrescriptionsWithItems,
};
