// Controller bệnh án (MED-01, MED-02, MED-03) + lịch sử bệnh lý phía chủ nuôi (PET-07).
// Theo rules.md §3: controller chỉ lấy dữ liệu từ req, gọi service, trả res
// bằng successResponse; luôn bọc bằng asyncHandler.
// req.vet do middleware requireApprovedVet gắn (vet.id = experts.id).
const medicalService = require('../services/medical.service');
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

const vetMedicalHistory = asyncHandler(async (req, res) => {
  const result = await medicalService.vetViewMedicalHistory(req.user.id, toIdParam(req.params.id));
  return successResponse(res, result, 'Lấy hồ sơ bệnh lý thành công');
});

const createMedicalRecord = asyncHandler(async (req, res) => {
  const result = await medicalService.createMedicalRecord(req.user.id, req.body);
  return successResponse(res, result, 'Tạo bệnh án thành công', 201);
});

const updateMedicalNotes = asyncHandler(async (req, res) => {
  const result = await medicalService.updateMedicalNotes(
    req.user.id,
    toIdParam(req.params.id),
    req.body,
  );
  return successResponse(res, result, 'Cập nhật ghi chú thành công');
});

const petMedicalHistory = asyncHandler(async (req, res) => {
  const result = await medicalService.petMedicalHistory(req.user.id, toIdParam(req.params.id));
  return successResponse(res, result, 'Lấy lịch sử bệnh lý thành công');
});

module.exports = {
  vetMedicalHistory,
  createMedicalRecord,
  updateMedicalNotes,
  petMedicalHistory,
};
