// Validator Joi cho bệnh án (MED-01, MED-02, MED-03) + lịch sử bệnh lý (PET-07).
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

const newPrescriptionSchema = Joi.object({
  severity: Joi.string().valid('mild', 'severe'),
  valid_until: Joi.date().iso().allow(null, ''),
  allow_reorder: Joi.boolean(),
  max_refills: Joi.number().integer().min(0).max(255).messages({
    'number.max': 'max_refills phải là số nguyên từ 0 đến 255',
  }),
  note: Joi.string().trim().max(255).allow(null, ''),
  items: Joi.array().items(prescriptionItemSchema),
});

const createMedicalRecordSchema = Joi.object({
  pet_id: Joi.number().integer().required().messages({
    'any.required': 'pet_id là bắt buộc',
  }),
  booking_id: Joi.number().integer().required().messages({
    'any.required': 'booking_id là bắt buộc (bệnh án phải gắn với 1 lịch hẹn)',
  }),
  symptoms: Joi.string().allow(null, ''),
  diagnosis: Joi.string().allow(null, ''),
  treatment: Joi.string().allow(null, ''),
  notes: Joi.string().allow(null, ''),
});

const updateMedicalNotesSchema = Joi.object({
  notes: Joi.string().allow(null, ''),
  diagnosis: Joi.string().allow(null, ''),
  treatment: Joi.string().allow(null, ''),
  symptoms: Joi.string().allow(null, ''),
  new_prescription: newPrescriptionSchema,
})
  .min(1)
  .messages({ 'object.min': 'Vui lòng cung cấp ít nhất một trường cần chỉnh sửa' });

module.exports = {
  createMedicalRecordSchema,
  updateMedicalNotesSchema,
};
