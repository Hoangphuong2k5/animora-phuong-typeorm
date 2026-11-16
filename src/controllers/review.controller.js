// Controller đánh giá chuyên viên (RVW-01, RVW-02).
// Theo rules.md §3: controller chỉ lấy dữ liệu từ req, gọi service, trả res
// bằng successResponse; luôn bọc bằng asyncHandler.
// RVW-02 trả kèm stats trong data (giữ nguyên dạng trả về của bản cũ:
// { items, pagination, stats }) thay vì dùng paginatedResponse.
const reviewService = require('../services/review.service');
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

const createReview = asyncHandler(async (req, res) => {
  const result = await reviewService.createReview(req.user.id, toIdParam(req.params.id), req.body);
  return successResponse(res, result, 'Đánh giá thành công', 201);
});

const listExpertReviews = asyncHandler(async (req, res) => {
  const { items, total, stats, page, limit } = await reviewService.listExpertReviews(
    toIdParam(req.params.id),
    req.query,
  );
  return successResponse(
    res,
    {
      items,
      pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
      stats,
    },
    'Lấy danh sách đánh giá thành công',
  );
});

module.exports = { createReview, listExpertReviews };
