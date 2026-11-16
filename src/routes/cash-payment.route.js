// Routes xác nhận thu tiền mặt (SPAY-05).
// URL giữ nguyên bản node-mssql đã giao 28/10:
// POST /api/v1/experts/me/bookings/:id/cash-payment.
// File này gắn TRỰC TIẾP vào router /api/v1 (không có tiền tố riêng) vì đường
// dẫn đã đầy đủ (xem patches/routes-index.patch.txt).
// Đặt tên cash-payment.* để KHÔNG đụng file payment.* của Toàn (VNPAY, SPAY-02).
const express = require('express');
const router = express.Router();
const cashPaymentController = require('../controllers/cash-payment.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { confirmCashPaymentSchema } = require('../validators/cash-payment.validator');
const { ROLES } = require('../utils/constants');

// [SPAY-05] Chuyên viên/admin xác nhận đã thu tiền mặt cho 1 lịch hẹn
router.post(
  '/experts/me/bookings/:id/cash-payment',
  verifyToken,
  authorizeRoles(ROLES.EXPERT, ROLES.ADMIN),
  validate(confirmCashPaymentSchema),
  cashPaymentController.confirmCashPayment,
);

module.exports = router;
