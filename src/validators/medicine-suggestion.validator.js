// Validator Joi cho đề xuất nhập thuốc (MED-09).
const Joi = require('joi');

const suggestMedicineSchema = Joi.object({
  medicine_name: Joi.string().trim().min(1).max(300).required().messages({
    'any.required': 'Tên thuốc đề xuất (medicine_name) là bắt buộc',
    'string.max': 'Tên thuốc không được vượt quá 300 ký tự',
  }),
  note: Joi.string().allow(null, ''),
});

module.exports = {
  suggestMedicineSchema,
};
