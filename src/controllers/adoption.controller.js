// Controller nhận nuôi (ADP-08, ADP-09, ADP-10, ADP-11).
// Theo rules.md §3: controller chỉ lấy dữ liệu từ req, gọi service, trả res
// bằng successResponse / paginatedResponse; luôn bọc bằng asyncHandler.
const adoptionService = require('../services/adoption.service');
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

const listMyApplications = asyncHandler(async (req, res) => {
  const { items, page, limit, totalItems } = await adoptionService.listMyApplications(
    req.user,
    req.query,
  );
  return paginatedResponse(res, items, page, limit, totalItems, 'Lấy danh sách đơn đăng ký thành công');
});

const decideApplication = asyncHandler(async (req, res) => {
  const result = await adoptionService.decideApplication(
    req.user,
    toIdParam(req.params.id),
    req.body,
  );
  return successResponse(res, result, 'Đã cập nhật quyết định');
});

const confirmHandover = asyncHandler(async (req, res) => {
  const result = await adoptionService.confirmHandover(req.user, toIdParam(req.params.id));
  return successResponse(res, result, 'Đã xác nhận bàn giao');
});

const createPetFromAdoption = asyncHandler(async (req, res) => {
  const result = await adoptionService.createPetFromAdoption(
    req.user,
    toIdParam(req.params.id),
    req.body || {},
  );
  return successResponse(res, result, 'Tạo hồ sơ pet sau nhận nuôi thành công', 201);
});

module.exports = {
  listMyApplications,
  decideApplication,
  confirmHandover,
  createPetFromAdoption,
};
