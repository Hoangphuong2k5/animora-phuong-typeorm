// Validator Joi cho sản phẩm + danh mục, theo mẫu validators/service.validator.js.
// Lưu ý khớp schema thật: cờ kê đơn là `requires_prescription` (giữ alias
// `is_prescription_required` để FE cũ vẫn gửi được — validate middleware có
// stripUnknown nên alias phải khai báo ở đây mới không bị cắt bỏ);
// trạng thái là `status` ('active'/'hidden', giữ alias `is_active`).
const Joi = require('joi');

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Tên danh mục là bắt buộc',
    'string.max': 'Tên danh mục không được vượt quá 100 ký tự',
  }),
  slug: Joi.string().trim().max(100).allow(null, ''),
  parent_id: Joi.number().integer().allow(null),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  slug: Joi.string().trim().max(100).allow(null, ''),
  parent_id: Joi.number().integer().allow(null),
})
  .min(1)
  .messages({ 'object.min': 'Vui lòng cung cấp ít nhất một trường cần chỉnh sửa' });

const createProductSchema = Joi.object({
  sku: Joi.string().trim().max(50).allow(null, ''),
  name: Joi.string().trim().min(1).max(150).required().messages({
    'any.required': 'Tên sản phẩm là bắt buộc',
    'string.max': 'Tên sản phẩm không được vượt quá 150 ký tự',
  }),
  slug: Joi.string().trim().max(150).allow(null, ''),
  brand: Joi.string().trim().max(100).allow(null, ''),
  category_id: Joi.number().integer().required().messages({
    'any.required': 'category_id là bắt buộc',
  }),
  price: Joi.number().min(0).required().messages({
    'any.required': 'Giá sản phẩm là bắt buộc',
    'number.min': 'Giá sản phẩm phải lớn hơn hoặc bằng 0',
  }),
  requires_prescription: Joi.boolean(),
  is_prescription_required: Joi.boolean(), // tên cũ, service map sang requires_prescription
  description: Joi.string().allow(null, ''),
  images: Joi.alternatives().try(Joi.string(), Joi.array()).allow(null),
  image_url: Joi.string().trim().max(500).allow(null, ''), // 1 URL, service gói thành [url]
  status: Joi.string().valid('active', 'hidden'),
  is_active: Joi.boolean(), // tên cũ, service map sang status
});

const updateProductSchema = Joi.object({
  sku: Joi.string().trim().max(50).allow(null, ''),
  name: Joi.string().trim().min(1).max(150),
  slug: Joi.string().trim().max(150).allow(null, ''),
  brand: Joi.string().trim().max(100).allow(null, ''),
  category_id: Joi.number().integer(),
  price: Joi.number().min(0).messages({
    'number.min': 'Giá sản phẩm phải lớn hơn hoặc bằng 0',
  }),
  requires_prescription: Joi.boolean(),
  is_prescription_required: Joi.boolean(),
  description: Joi.string().allow(null, ''),
  images: Joi.alternatives().try(Joi.string(), Joi.array()).allow(null),
  image_url: Joi.string().trim().max(500).allow(null, ''),
  status: Joi.string().valid('active', 'hidden'),
  is_active: Joi.boolean(),
})
  .min(1)
  .messages({ 'object.min': 'Vui lòng cung cấp ít nhất một trường cần chỉnh sửa' });

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  createProductSchema,
  updateProductSchema,
};
