// Routes hồ sơ thú cưng (PET-01, PET-02, PET-03, PET-05).
// URL giữ nguyên bản node-mssql đã giao 28/10, chỉ đổi middleware sang của nhóm:
// verifyToken + authorizeRoles('customer') thay cho requireRole('customer').
// PET-07 (GET /:id/medical-records) thuộc module medical, không nằm ở đây —
// khi làm module medical thì gắn thêm route đó vào file này hoặc medical.route.js.
const express = require('express');
const router = express.Router();
const petController = require('../controllers/pet.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createPetSchema,
  updatePetSchema,
  createVaccinationSchema,
  updateAllergiesSchema,
} = require('../validators/pet.validator');
const { ROLES } = require('../utils/constants');

router.use(verifyToken, authorizeRoles(ROLES.CUSTOMER));

// [PET-01] Thêm hồ sơ pet
router.post('/', validate(createPetSchema), petController.createPet);
// [PET-03] Danh sách pet của tôi
router.get('/', petController.listMyPets);
// [PET-03] Chi tiết pet
router.get('/:id', petController.getPetById);
// [PET-02] Cập nhật hồ sơ pet
router.put('/:id', validate(updatePetSchema), petController.updatePet);
// [PET-05] Danh sách tiêm chủng
router.get('/:id/vaccinations', petController.listVaccinations);
// [PET-05] Thêm mũi tiêm
router.post('/:id/vaccinations', validate(createVaccinationSchema), petController.addVaccination);
// [PET-05] Cập nhật dị ứng
router.put('/:id/allergies', validate(updateAllergiesSchema), petController.updateAllergies);

module.exports = router;
