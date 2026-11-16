// Controller đề xuất nhập thuốc (MED-09).
// Theo rules.md §3: controller chỉ lấy dữ liệu từ req, gọi service, trả res
// bằng successResponse / paginatedResponse; luôn bọc bằng asyncHandler.
const medicineSuggestionService = require('../services/medicine-suggestion.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, paginatedResponse } = require('../utils/apiResponse');

const suggestMedicine = asyncHandler(async (req, res) => {
  const result = await medicineSuggestionService.suggestMedicine(req.user, req.body);
  return successResponse(res, result, 'Đã gửi đề xuất nhập thuốc', 201);
});

const listMedicineSuggestions = asyncHandler(async (req, res) => {
  const { items, page, limit, totalItems } =
    await medicineSuggestionService.listMedicineSuggestions(req.query);
  return paginatedResponse(res, items, page, limit, totalItems, 'Lấy danh sách đề xuất thành công');
});

module.exports = {
  suggestMedicine,
  listMedicineSuggestions,
};
