// Routes nhận nuôi (ADP-08, ADP-09, ADP-10, ADP-11).
// URL giữ nguyên bản node-mssql đã giao 28/10.
// File này gắn TRỰC TIẾP vào router /api/v1 (không có tiền tố riêng) vì các
// đường dẫn đã đầy đủ: /shelters/me/adoption-applications, /adoption-applications/...
// (xem patches/routes-index.patch.txt).
//
// Lưu ý role 'shelter': dbo.users.role có 'shelter' (trạm cứu hộ) nhưng
// utils/constants.js ROLES của nhóm hiện chưa có SHELTER nên ở đây dùng chuỗi
// 'shelter' trực tiếp. Khi ghép, nhóm thêm SHELTER: 'shelter' vào ROLES rồi
// đổi authorizeRoles('shelter') thành authorizeRoles(ROLES.SHELTER) cho đồng nhất.
const express = require('express');
const router = express.Router();
const adoptionController = require('../controllers/adoption.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  decideApplicationSchema,
  createPetFromAdoptionSchema,
} = require('../validators/adoption.validator');
const { ROLES } = require('../utils/constants');

router.use(verifyToken);

// [ADP-08] Trạm xem đơn đăng ký nhận nuôi của trạm mình
router.get('/shelters/me/adoption-applications', authorizeRoles('shelter'), adoptionController.listMyApplications);
// [ADP-09] Trạm duyệt / từ chối đơn
router.put('/shelters/me/adoption-applications/:id/decision', authorizeRoles('shelter'), validate(decideApplicationSchema), adoptionController.decideApplication);
// [ADP-10] Trạm hoặc người đăng ký xác nhận bàn giao
router.post('/shelters/me/adoption-applications/:id/handover', authorizeRoles('shelter', ROLES.CUSTOMER), adoptionController.confirmHandover);
// [ADP-11] Khách tạo hồ sơ pet từ thú cưng vừa nhận nuôi
router.post('/adoption-applications/:id/create-pet', authorizeRoles(ROLES.CUSTOMER), validate(createPetFromAdoptionSchema), adoptionController.createPetFromAdoption);

module.exports = router;
