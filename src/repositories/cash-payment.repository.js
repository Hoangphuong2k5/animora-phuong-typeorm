// Tầng truy vấn CSDL cho SPAY-05 (xác nhận thu tiền mặt).
// Chỉ làm việc với TypeORM DataSource, theo đúng mẫu repositories trong rules.md §7.2.
//
// Bảng bookings (của Toàn) và experts (của Hoàng) chỉ đọc/ghi bằng raw SQL,
// không tự định nghĩa entity để tránh đụng khi file booking.entity.js /
// expert.entity.js của họ được thêm vào.
// Raw SQL TypeORM cho mssql dùng tham số vị trí @0, @1, ...
const { AppDataSource } = require('../config/data-source');
const { PaymentEntity } = require('../entities/payment.entity');

const getPaymentRepo = (manager) =>
  manager ? manager.getRepository(PaymentEntity) : AppDataSource.getRepository(PaymentEntity);

const createPayment = async (paymentData, manager = null) => {
  const repo = getPaymentRepo(manager);
  const row = repo.create(paymentData);
  return await repo.save(row);
};

// Đọc 1 booking (phục vụ SPAY-05: kiểm tra lịch + số tiền + payment_status).
const findBookingById = async (bookingId, manager = null) => {
  const db = manager || AppDataSource;
  const rows = await db.query(`SELECT * FROM dbo.bookings WHERE id = @0`, [Number(bookingId)]);
  return rows[0] || null;
};

// Tìm experts.id qua user_id (chuyên viên chỉ xác nhận lịch của chính mình).
const findExpertIdByUserId = async (userId, manager = null) => {
  const db = manager || AppDataSource;
  const rows = await db.query(`SELECT id FROM dbo.experts WHERE user_id = @0`, [
    Number(userId),
  ]);
  return rows[0] ? rows[0].id : null;
};

// Chống thu trùng: đã có payment cash/success/charge cho booking này chưa.
const countExistingCashPayment = async (bookingId, manager = null) => {
  const db = manager || AppDataSource;
  const rows = await db.query(
    `SELECT COUNT(*) AS c FROM dbo.payments
     WHERE booking_id = @0 AND kind = 'charge'
       AND method = 'cash' AND [status] = 'success'`,
    [Number(bookingId)],
  );
  return Number(rows[0].c);
};

const updateBookingPaymentStatus = async (bookingId, paymentStatus, manager = null) => {
  const db = manager || AppDataSource;
  await db.query(`UPDATE dbo.bookings SET payment_status = @1 WHERE id = @0`, [
    Number(bookingId),
    paymentStatus,
  ]);
};

module.exports = {
  createPayment,
  findBookingById,
  findExpertIdByUserId,
  countExistingCashPayment,
  updateBookingPaymentStatus,
};
