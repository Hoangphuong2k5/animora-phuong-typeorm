// Validator Joi cho đánh giá chuyên viên (RVW-01, RVW-02).
const Joi = require('joi');

const createReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required().messages({
    'any.required': 'Điểm đánh giá (rating) là bắt buộc',
    'number.min': 'rating phải là số nguyên từ 1 đến 5',
    'number.max': 'rating phải là số nguyên từ 1 đến 5',
  }),
  comment: Joi.string().allow(null, ''),
});

module.exports = {
  createReviewSchema,
};
