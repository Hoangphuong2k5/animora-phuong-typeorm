// Validator Joi cho nhận nuôi (ADP-08, ADP-09, ADP-10, ADP-11).
// Lưu ý: schema KHÔNG có cột reject_reason nên field này chỉ được nhận rồi bỏ qua
// (xem PHUONG-CONVERSION.md, mục "2 điểm schema nhóm chưa quyết").
const Joi = require('joi');

const decideApplicationSchema = Joi.object({
  decision: Joi.string().valid('approved', 'rejected').required().messages({
    'any.required': 'decision là bắt buộc',
    'any.only': "decision chỉ nhận 'approved' hoặc 'rejected'",
  }),
  reject_reason: Joi.string().trim().max(500).allow(null, ''), // nhận nhưng KHÔNG lưu (schema chưa có cột)
});

const createPetFromAdoptionSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).allow(null, ''),
  species: Joi.string().valid('dog', 'cat', 'bird', 'rabbit', 'other').allow(null, ''),
  breed: Joi.string().trim().max(100).allow(null, ''),
  gender: Joi.string().valid('male', 'female', 'unknown').allow(null, ''),
  birth_date: Joi.date().iso().allow(null, ''),
  weight: Joi.number().positive().messages({
    'number.positive': 'Cân nặng phải lớn hơn 0',
  }),
  color: Joi.string().trim().max(50).allow(null, ''),
  avatar: Joi.string().trim().max(255).allow(null, ''),
  avatar_url: Joi.string().trim().max(255).allow(null, ''), // tên cũ, map sang avatar ở service
  allergies: Joi.alternatives().try(Joi.string(), Joi.array(), Joi.object()).allow(null),
});

module.exports = {
  decideApplicationSchema,
  createPetFromAdoptionSchema,
};
