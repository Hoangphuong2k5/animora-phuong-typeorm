// Validator Joi cho pets, theo mẫu validators/service.validator.js của nhóm.
// Lưu ý: cột cân nặng là `weight` (schema thật), KHÔNG nhận `weight_kg` như
// ví dụ trong rules.md §7.2 — field đó sẽ bị validate middleware strip bỏ.
const Joi = require('joi');

const createPetSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Tên thú cưng là bắt buộc',
    'string.max': 'Tên thú cưng không được vượt quá 100 ký tự',
  }),
  species: Joi.string().valid('dog', 'cat', 'bird', 'rabbit', 'other').required().messages({
    'any.required': 'Loài (species) là bắt buộc',
    'any.only': 'Loài chỉ nhận dog, cat, bird, rabbit hoặc other',
  }),
  breed: Joi.string().trim().max(100).allow(null, ''),
  gender: Joi.string().valid('male', 'female', 'unknown').default('unknown'),
  birth_date: Joi.date().iso().allow(null, ''),
  weight: Joi.number().positive().messages({
    'number.positive': 'Cân nặng phải lớn hơn 0',
  }),
  color: Joi.string().trim().max(50).allow(null, ''),
  avatar: Joi.string().trim().max(255).allow(null, ''),
  avatar_url: Joi.string().trim().max(255).allow(null, ''), // tên cũ, map sang avatar ở service
  allergies: Joi.alternatives().try(Joi.string(), Joi.array(), Joi.object()).allow(null),
  chronic: Joi.alternatives().try(Joi.string(), Joi.array(), Joi.object()).allow(null),
});

const updatePetSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  species: Joi.string().valid('dog', 'cat', 'bird', 'rabbit', 'other'),
  breed: Joi.string().trim().max(100).allow(null, ''),
  gender: Joi.string().valid('male', 'female', 'unknown'),
  birth_date: Joi.date().iso().allow(null, ''),
  weight: Joi.number().positive().messages({
    'number.positive': 'Cân nặng phải lớn hơn 0',
  }),
  color: Joi.string().trim().max(50).allow(null, ''),
  avatar: Joi.string().trim().max(255).allow(null, ''),
  avatar_url: Joi.string().trim().max(255).allow(null, ''),
  allergies: Joi.alternatives().try(Joi.string(), Joi.array(), Joi.object()).allow(null),
  chronic: Joi.alternatives().try(Joi.string(), Joi.array(), Joi.object()).allow(null),
})
  .min(1)
  .messages({ 'object.min': 'Vui lòng cung cấp ít nhất một trường cần chỉnh sửa' });

const createVaccinationSchema = Joi.object({
  vaccine_name: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Tên vaccine là bắt buộc',
    'string.max': 'Tên vaccine không được vượt quá 100 ký tự',
  }),
  vaccinated_at: Joi.date().iso().allow(null, ''),
  vaccinated_date: Joi.date().iso().allow(null, ''), // tên cũ, map sang vaccinated_at ở service
  next_due_date: Joi.date().iso().allow(null, ''),
  note: Joi.string().trim().max(255).allow(null, ''),
});

const updateAllergiesSchema = Joi.object({
  allergies: Joi.alternatives().try(Joi.string(), Joi.array(), Joi.object()).required().messages({
    'any.required': 'Thông tin dị ứng là bắt buộc',
  }),
});

module.exports = {
  createPetSchema,
  updatePetSchema,
  createVaccinationSchema,
  updateAllergiesSchema,
};
