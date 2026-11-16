// Service đề xuất nhập thuốc (MED-09).
// Logic giữ nguyên bản node-mssql đã giao 28/10 (phần suggestMedicine /
// listMedicineSuggestions trong prescriptionService cũ), chỉ đổi tầng truy vấn
// từ SQL thô sang TypeORM theo rules.md §3.
// Bảng dbo.medicine_suggestions không có trong schema gốc — nhóm chạy file
// docs/migration-medicine-suggestions.sql để tạo bảng này trước khi dùng.
const medicineSuggestionRepository = require('../repositories/medicine-suggestion.repository');
const medicalRepository = require('../repositories/medical.repository');
const ApiError = require('../utils/ApiError');

// MED-09: bác sĩ/admin đề xuất nhập thuốc chưa có trong Shop (trạng thái chờ duyệt).
// Role expert phải là bác sĩ đã duyệt (vet); admin thì không cần kiểm tra vet.
async function suggestMedicine(user, body) {
  if (!body.medicine_name) {
    throw new ApiError(400, 'Thiếu tên thuốc đề xuất (medicine_name)', 'BAD_REQUEST');
  }
  if (user.role === 'expert') {
    const vet = await medicalRepository.findApprovedVetByUserId(user.id);
    if (!vet) {
      throw new ApiError(403, 'Chỉ bác sĩ thú y đã được duyệt mới thực hiện được', 'FORBIDDEN');
    }
  }
  return await medicineSuggestionRepository.createSuggestion({
    suggested_by: user.id,
    suggested_by_role: user.role,
    medicine_name: body.medicine_name,
    note: body.note || null,
    status: 'pending',
  });
}

// MED-09 (phụ trợ): admin xem danh sách đề xuất để duyệt.
async function listMedicineSuggestions(queryParams) {
  const page = parseInt(queryParams.page, 10) || 1;
  const limit = parseInt(queryParams.limit, 10) || parseInt(queryParams.pageSize, 10) || 10;
  const result = await medicineSuggestionRepository.listSuggestions({
    status: queryParams.status || null,
    page,
    limit: Math.min(limit, 100),
  });
  return {
    items: result.items,
    page,
    limit: Math.min(limit, 100),
    totalItems: result.total,
  };
}

module.exports = {
  suggestMedicine,
  listMedicineSuggestions,
};
