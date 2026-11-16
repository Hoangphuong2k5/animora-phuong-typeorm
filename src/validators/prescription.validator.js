// Validator Joi cho đơn thuốc (MED-04, MED-05, MED-06, MED-07, MED-08).
// (MED-09 nằm ở medicine-suggestion.validator.js.)
const Joi = require('joi');

const prescriptionItemSchema = Joi.object({
  product_id: Joi.number().integer().required().messages({
    'any.required': 'product_id là bắt buộc',
  }),
  quantity: Joi.number().integer().positive().required().messages({
    'any.required': 'Số lượng (quantity) là bắt buộc',
    'number.positive': 'Số lượng phải lớn hơn 0',
  }),
  dosage: Joi.string().trim().max(100).allow(null, ''),
  frequency: Joi.string().trim().max(100).allow(null, ''),
  duration_days: Joi.number().integer().positive().allow(null),
  usage_note: Joi.string().trim().max(255).allow(null, ''),
  note: Joi.string().trim().max(255).allow(null, ''), // tên cũ, service map sang usage_note
});

const createPrescriptionSchema = Joi.object({
  medical_record_id: Joi.number().integer().required().messages({
    'any.required': 'medical_record_id là bắt buộc (đơn phải gắn với 1 bệnh án)',
  }),
  pet_id: Joi.number().integer(),
  severity: Joi.string().valid('mild', 'severe').required().messages({
    'any.required': 'Mức độ bệnh (severity) là bắt buộc',
    'any.only': "severity chỉ nhận 'mild' hoặc 'severe'",
  }),
  valid_until: Joi.date().iso().allow(null, ''),
  allow_reorder: Joi.boolean(),
  max_refills: Joi.number().integer().min(0).max(255).messages({
    'number.max': 'max_refills phải là số nguyên từ 0 đến 255',
  }),
  note: Joi.string().trim().max(255).allow(null, ''),
  items: Joi.array().items(prescriptionItemSchema),
});

const updatePrescriptionSchema = Joi.object({
  severity: Joi.string().valid('mild', 'severe'),
  valid_until: Joi.date().iso().allow(null, ''),
  allow_reorder: Joi.boolean(),
  max_refills: Joi.number().integer().min(0).max(255).messages({
    'number.max': 'max_refills phải là số nguyên từ 0 đến 255',
  }),
  note: Joi.string().trim().max(255).allow(null, ''),
  items: Joi.array().items(prescriptionItemSchema),
})
  .min(1)
  .messages({ 'object.min': 'Vui lòng cung cấp ít nhất một trường cần chỉnh sửa' });

const validatePurchaseSchema = Joi.object({
  prescription_id: Joi.number().integer().allow(null),
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.number().integer().required(),
        quantity: Joi.number().integer().positive().required(),
      }),
    )
    .required()
    .messages({
      'any.required': 'Danh sách items là bắt buộc',
    }),
});

module.exports = {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  validatePurchaseSchema,
};
