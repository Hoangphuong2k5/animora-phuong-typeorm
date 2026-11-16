// Routes sản phẩm + danh mục (PRD-01, PRD-02, PRD-03, PRD-04, PRD-05).
// URL giữ nguyên bản node-mssql đã giao 28/10, chỉ đổi middleware sang của nhóm:
// verifyToken + authorizeRoles(ROLES.ADMIN) thay cho requireRole('admin').
// File này gắn TRỰC TIẾP vào router /api/v1 (không có tiền tố riêng) vì các
// đường dẫn đã đầy đủ: /products, /categories, /admin/products, /admin/categories
// (xem patches/routes-index.patch.txt).
// Xem/tìm kiếm sản phẩm và danh mục là công khai; tạo/sửa/xóa cần quyền admin.
const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createCategorySchema,
  updateCategorySchema,
  createProductSchema,
  updateProductSchema,
} = require('../validators/product.validator');
const { ROLES } = require('../utils/constants');

// [PRD-01] Tìm kiếm/lọc/phân trang sản phẩm (công khai)
router.get('/products', productController.searchProducts);
// [PRD-02] Chi tiết sản phẩm + tồn kho (công khai)
router.get('/products/:id', productController.getProductDetail);
// [PRD-03] Danh sách danh mục (công khai)
router.get('/categories', productController.listCategories);

// [PRD-03] Admin quản lý danh mục
router.post('/admin/categories', verifyToken, authorizeRoles(ROLES.ADMIN), validate(createCategorySchema), productController.createCategory);
router.put('/admin/categories/:id', verifyToken, authorizeRoles(ROLES.ADMIN), validate(updateCategorySchema), productController.updateCategory);
router.delete('/admin/categories/:id', verifyToken, authorizeRoles(ROLES.ADMIN), productController.deleteCategory);

// [PRD-04] Admin tạo sản phẩm
router.post('/admin/products', verifyToken, authorizeRoles(ROLES.ADMIN), validate(createProductSchema), productController.createProduct);
// [PRD-05] Admin cập nhật sản phẩm
router.put('/admin/products/:id', verifyToken, authorizeRoles(ROLES.ADMIN), validate(updateProductSchema), productController.updateProduct);

module.exports = router;
