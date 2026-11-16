// Service xác nhận thu tiền mặt (SPAY-05).
// Logic giữ nguyên bản node-mssql đã giao 28/10, chỉ đổi tầng truy vấn từ SQL thô
// sang TypeORM theo rules.md §3.
// Khớp schema thật dbo.payments (xem docs/schema-assumptions.md mục 9): cột method
// (không phải payment_method), kind, paid_at, confirmed_by. Số tiền lấy từ
// bookings.total_amount.
const { AppDataSource } = require('../config/data-source');
const cashPaymentRepository = require('../repositories/cash-payment.repository');
const ApiError = require('../utils/ApiError');

// POST /experts/me/bookings/:id/cash-payment
// Chuyên viên xác nhận đã thu tiền mặt cho lịch của chính mình (admin cũng được phép).
// Tạo payments (kind='charge', method='cash', status='success') và chuyển
// booking.payment_status thành 'paid' trong 1 transaction.
// Chống thu trùng: booking đã paid, hoặc đã có payment cash/success/charge cho booking.
async function confirmCashPayment(user, bookingId, body) {
  return await AppDataSource.transaction(async (manager) => {
    const booking = await cashPaymentRepository.findBookingById(bookingId, manager);
    if (!booking) throw new ApiError(404, 'Không tìm thấy lịch hẹn', 'NOT_FOUND');
    if (user.role === 'expert') {
      // Chuyên viên chỉ xác nhận lịch của chính mình: tìm experts.id qua user_id.
      const myExpertId = await cashPaymentRepository.findExpertIdByUserId(user.id, manager);
      const compareId = myExpertId !== null ? myExpertId : user.id;
      if (Number(booking.expert_id) !== Number(compareId)) {
        throw new ApiError(403, 'Chỉ chuyên viên phụ trách lịch này mới được xác nhận thu tiền', 'FORBIDDEN');
      }
    }
    if (booking.payment_status === 'paid') {
      throw new ApiError(409, 'Lịch hẹn này đã được thanh toán', 'CONFLICT');
    }
    const dup = await cashPaymentRepository.countExistingCashPayment(bookingId, manager);
    if (dup > 0) {
      throw new ApiError(409, 'Lịch hẹn này đã có giao dịch thu tiền mặt thành công', 'CONFLICT');
    }
    const amount = Number(booking.total_amount);
    if (!amount || amount <= 0) {
      throw new ApiError(409, 'Không xác định được số tiền cần thu (booking chưa có total_amount)', 'CONFLICT');
    }
    const payment = await cashPaymentRepository.createPayment(
      {
        booking_id: bookingId,
        order_id: null,
        kind: 'charge',
        amount,
        method: 'cash',
        provider: null,
        txn_ref: null,
        status: 'success',
        paid_at: new Date(),
        confirmed_by: user.id,
        note: body.note || null,
      },
      manager,
    );
    await cashPaymentRepository.updateBookingPaymentStatus(bookingId, 'paid', manager);
    return payment;
  });
}

module.exports = { confirmCashPayment };
