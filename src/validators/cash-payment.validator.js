// Validator Joi cho xác nhận thu tiền mặt (SPAY-05).
// Body có thể rỗng (chỉ cần booking id trên URL); note là tùy chọn.
const Joi = require('joi');

const confirmCashPaymentSchema = Joi.object({
  note: Joi.string().trim().max(255).allow(null, ''),
});

module.exports = {
  confirmCashPaymentSchema,
};
