// Controller xác nhận thu tiền mặt (SPAY-05).
// Theo rules.md §3: controller chỉ lấy dữ liệu từ req, gọi service, trả res
// bằng successResponse; luôn bọc bằng asyncHandler.
const cashPaymentService = require('../services/cash-payment.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const ApiError = require('../utils/ApiError');

// Tham số :id trên URL phải là số nguyên (bản cũ dùng toIntParam, sai thì 400).
function toIdParam(value) {
  const id = Number(value);
  if (!Number.isInteger(id)) {
    throw new ApiError(400, 'Tham số id không hợp lệ', 'BAD_REQUEST');
  }
  return id;
}

const confirmCashPayment = asyncHandler(async (req, res) => {
  const result = await cashPaymentService.confirmCashPayment(
    req.user,
    toIdParam(req.params.id),
    req.body || {},
  );
  return successResponse(res, result, 'Xác nhận thu tiền mặt thành công', 201);
});

module.exports = { confirmCashPayment };
