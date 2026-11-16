// Controller đơn thuốc (MED-04, MED-05, MED-06, MED-07, MED-08).
// (MED-09 nằm ở medicine-suggestion.controller.js.)
// Theo rules.md §3: controller chỉ lấy dữ liệu từ req, gọi service, trả res
// bằng successResponse / paginatedResponse; luôn bọc bằng asyncHandler.
const prescriptionService = require('../services/prescription.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, paginatedResponse } = require('../utils/apiResponse');
const ApiError = require('../utils/ApiError');

// Tham số :id trên URL phải là số nguyên (bản cũ dùng toIntParam, sai thì 400).
function toIdParam(value) {
  const id = Number(value);
  if (!Number.isInteger(id)) {
    throw new ApiError(400, 'Tham số id không hợp lệ', 'BAD_REQUEST');
  }
  return id;
}

const createPrescription = asyncHandler(async (req, res) => {
  const result = await prescriptionService.createPrescription(req.user.id, req.body);
  return successResponse(res, result, 'Kê đơn thành công', 201);
});

const updatePrescriptionVersion = asyncHandler(async (req, res) => {
  const result = await prescriptionService.updatePrescriptionVersion(
    req.user.id,
    toIdParam(req.params.id),
    req.body,
  );
  return successResponse(res, result, 'Đã tạo phiên bản đơn thuốc mới');
});

const listPrescriptionHistory = asyncHandler(async (req, res) => {
  const { items, page, limit, totalItems } = await prescriptionService.listPrescriptionHistory(
    req.user,
    req.query,
  );
  return paginatedResponse(res, items, page, limit, totalItems, 'Lấy lịch sử đơn thuốc thành công');
});

const validatePurchase = asyncHandler(async (req, res) => {
  const result = await prescriptionService.validatePurchase(req.user, req.body || {});
  return successResponse(res, result, result.valid ? 'Giỏ hàng hợp lệ' : 'Giỏ hàng chưa đủ điều kiện mua');
});

const reorderPrescription = asyncHandler(async (req, res) => {
  const result = await prescriptionService.reorderPrescription(req.user, toIdParam(req.params.id));
  return successResponse(res, result, 'Đã thêm thuốc vào giỏ hàng');
});

module.exports = {
  createPrescription,
  updatePrescriptionVersion,
  listPrescriptionHistory,
  validatePurchase,
  reorderPrescription,
};
