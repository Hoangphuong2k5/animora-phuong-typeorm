// Routes đơn thuốc (MED-04, MED-05, MED-06, MED-07, MED-08).
// (MED-09 nằm ở medicine-suggestion.route.js.)
// URL giữ nguyên bản node-mssql đã giao 28/10. Bác sĩ dùng middleware
// requireApprovedVet (mới, xem src/middlewares/vet.middleware.js).
// File này gắn TRỰC TIẾP vào router /api/v1 (không có tiền tố riêng) vì các
// đường dẫn đã đầy đủ: /vet/prescriptions, /prescriptions, ...
// (xem patches/routes-index.patch.txt).
const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescription.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { requireApprovedVet } = require('../middlewares/vet.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  validatePurchaseSchema,
} = require('../validators/prescription.validator');
const { ROLES } = require('../utils/constants');

router.use(verifyToken);

// [MED-04] Bác sĩ kê đơn (expert + vet approved)
router.post('/vet/prescriptions', requireApprovedVet, validate(createPrescriptionSchema), prescriptionController.createPrescription);
// [MED-05] Bác sĩ cập nhật đơn thuốc = tạo phiên bản mới (expert + vet approved)
router.put('/vet/prescriptions/:id', requireApprovedVet, validate(updatePrescriptionSchema), prescriptionController.updatePrescriptionVersion);

// [MED-06] Lịch sử đơn thuốc (KH xem đơn của pet mình, BS xem đơn mình từng khám/kê)
router.get('/prescriptions', authorizeRoles(ROLES.CUSTOMER, ROLES.EXPERT, ROLES.ADMIN), prescriptionController.listPrescriptionHistory);

// [MED-07] Kiểm tra điều kiện mua thuốc theo đơn (BR-MED-08)
router.post('/prescriptions/validate-purchase', authorizeRoles(ROLES.CUSTOMER), validate(validatePurchaseSchema), prescriptionController.validatePurchase);

// [MED-08] Mua lại đơn thuốc bệnh nhẹ
router.post('/prescriptions/:id/reorder', authorizeRoles(ROLES.CUSTOMER), prescriptionController.reorderPrescription);

module.exports = router;
