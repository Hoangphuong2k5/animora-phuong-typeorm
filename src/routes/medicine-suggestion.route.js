// Routes đề xuất nhập thuốc (MED-09).
// URL giữ nguyên bản node-mssql đã giao 28/10 (trước đây nằm trong
// prescriptions.routes.js, nay tách thành module riêng).
// File này gắn TRỰC TIẾP vào router /api/v1 (không có tiền tố riêng) vì đường
// dẫn đã đầy đủ: /medicine-suggestions (xem patches/routes-index.patch.txt).
// Cần chạy migration docs/migration-medicine-suggestions.sql trước thì 2
// endpoint này mới hoạt động (bảng medicine_suggestions chưa có trong schema gốc).
const express = require('express');
const router = express.Router();
const medicineSuggestionController = require('../controllers/medicine-suggestion.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { suggestMedicineSchema } = require('../validators/medicine-suggestion.validator');
const { ROLES } = require('../utils/constants');

router.use(verifyToken);

// [MED-09] Bác sĩ/admin đề xuất nhập thuốc chưa có trong Shop
router.post('/medicine-suggestions', authorizeRoles(ROLES.EXPERT, ROLES.ADMIN), validate(suggestMedicineSchema), medicineSuggestionController.suggestMedicine);
// [MED-09] Admin xem danh sách đề xuất để duyệt
router.get('/medicine-suggestions', authorizeRoles(ROLES.ADMIN), medicineSuggestionController.listMedicineSuggestions);

module.exports = router;
