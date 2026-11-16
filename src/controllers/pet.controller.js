// Controller hồ sơ thú cưng + tiêm chủng (PET-01, PET-02, PET-03, PET-05).
// Theo rules.md §3: controller chỉ lấy dữ liệu từ req, gọi service, trả res
// bằng successResponse; luôn bọc bằng asyncHandler.
const petService = require('../services/pet.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');

const createPet = asyncHandler(async (req, res) => {
  const result = await petService.createPet(req.user.id, req.body);
  return successResponse(res, result, 'Tạo hồ sơ thú cưng thành công', 201);
});

const updatePet = asyncHandler(async (req, res) => {
  const result = await petService.updatePet(req.user.id, req.params.id, req.body, req.ip);
  return successResponse(res, result, 'Cập nhật hồ sơ thành công');
});

const listMyPets = asyncHandler(async (req, res) => {
  const result = await petService.listMyPets(req.user.id);
  return successResponse(res, result, 'Lấy danh sách thú cưng thành công');
});

const getPetById = asyncHandler(async (req, res) => {
  const result = await petService.getPetById(req.user.id, req.params.id);
  return successResponse(res, result, 'Lấy thông tin thú cưng thành công');
});

const listVaccinations = asyncHandler(async (req, res) => {
  const result = await petService.listVaccinations(req.user.id, req.params.id);
  return successResponse(res, result, 'Lấy lịch tiêm chủng thành công');
});

const addVaccination = asyncHandler(async (req, res) => {
  const result = await petService.addVaccination(req.user.id, req.params.id, req.body);
  return successResponse(res, result, 'Thêm lịch tiêm thành công', 201);
});

const updateAllergies = asyncHandler(async (req, res) => {
  const result = await petService.updateAllergies(req.user.id, req.params.id, req.body.allergies);
  return successResponse(res, result, 'Cập nhật dị ứng thành công');
});

module.exports = {
  createPet,
  updatePet,
  listMyPets,
  getPetById,
  listVaccinations,
  addVaccination,
  updateAllergies,
};
