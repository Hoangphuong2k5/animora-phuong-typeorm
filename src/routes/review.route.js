// Routes đánh giá chuyên viên (RVW-01, RVW-02).
// URL giữ nguyên bản node-mssql đã giao 28/10.
// File này gắn TRỰC TIẾP vào router /api/v1 (không có tiền tố riêng) vì các
// đường dẫn đã đầy đủ: /bookings/:id/review, /experts/:id/reviews
// (xem patches/routes-index.patch.txt).
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { createReviewSchema } = require('../validators/review.validator');
const { ROLES } = require('../utils/constants');

// [RVW-01] Khách đánh giá chuyên viên sau dịch vụ
router.post('/bookings/:id/review', verifyToken, authorizeRoles(ROLES.CUSTOMER), validate(createReviewSchema), reviewController.createReview);
// [RVW-02] Xem đánh giá chuyên viên (công khai)
router.get('/experts/:id/reviews', reviewController.listExpertReviews);

module.exports = router;
