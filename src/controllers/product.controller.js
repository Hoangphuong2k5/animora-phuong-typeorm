// Controller sản phẩm + danh mục (PRD-01, PRD-02, PRD-03, PRD-04, PRD-05).
// Theo rules.md §3: controller chỉ lấy dữ liệu từ req, gọi service, trả res
// bằng successResponse / paginatedResponse; luôn bọc bằng asyncHandler.
const productService = require('../services/product.service');
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

const listCategories = asyncHandler(async (req, res) => {
  const result = await productService.listCategories();
  return successResponse(res, result, 'Lấy danh sách danh mục thành công');
});

const createCategory = asyncHandler(async (req, res) => {
  const result = await productService.createCategory(req.body);
  return successResponse(res, result, 'Tạo danh mục thành công', 201);
});

const updateCategory = asyncHandler(async (req, res) => {
  const result = await productService.updateCategory(toIdParam(req.params.id), req.body);
  return successResponse(res, result, 'Cập nhật danh mục thành công');
});

const deleteCategory = asyncHandler(async (req, res) => {
  const result = await productService.deleteCategory(toIdParam(req.params.id));
  return successResponse(res, result, 'Xóa danh mục thành công');
});

const createProduct = asyncHandler(async (req, res) => {
  const result = await productService.createProduct(req.body);
  return successResponse(res, result, 'Tạo sản phẩm thành công', 201);
});

const updateProduct = asyncHandler(async (req, res) => {
  const result = await productService.updateProduct(
    req.user.id,
    toIdParam(req.params.id),
    req.body,
    req.ip,
  );
  return successResponse(res, result, 'Cập nhật sản phẩm thành công');
});

const searchProducts = asyncHandler(async (req, res) => {
  const { items, page, limit, totalItems } = await productService.searchProducts(req.query);
  return paginatedResponse(res, items, page, limit, totalItems, 'Lấy danh sách sản phẩm thành công');
});

const getProductDetail = asyncHandler(async (req, res) => {
  const result = await productService.getProductDetail(toIdParam(req.params.id));
  return successResponse(res, result, 'Lấy chi tiết sản phẩm thành công');
});

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createProduct,
  updateProduct,
  searchProducts,
  getProductDetail,
};
