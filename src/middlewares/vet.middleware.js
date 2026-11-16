// Middleware kiểm tra bác sĩ thú y đã được duyệt (dùng cho các route /vet/...).
// Bản node-mssql cũ có middleware này trong middlewares/auth.js (requireApprovedVet);
// repo nhóm hiện chưa có nên file này là file mới cần copy vào
// Nhom-14/backend/src/middlewares/ cùng các file khác (xem patches/).
//
// Bác sĩ = user role 'expert' + có dòng dbo.experts với type='vet' và
// status='approved' (dbo.users.role KHÔNG có 'vet' — xem
// docs/schema-assumptions.md mục 7). Gắn dòng experts đó vào req.vet để
// service dùng lại (vet.id = experts.id, dùng cho medical_records.vet_id
// và prescriptions.vet_id).
//
// Lưu ý: bảng experts thuộc phần của Hoàng (expert.*) nên ở đây chỉ đọc bằng
// raw SQL qua AppDataSource, không tự định nghĩa ExpertEntity để tránh đụng
// khi file expert.entity.js của Hoàng được thêm vào.
const { AppDataSource } = require('../config/data-source');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const requireApprovedVet = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.id) {
    throw new ApiError(401, 'Yêu cầu đăng nhập để truy cập tài nguyên này', 'UNAUTHORIZED');
  }
  // Raw SQL TypeORM cho mssql dùng tham số vị trí @0, @1, ...
  const rows = await AppDataSource.query(
    `SELECT * FROM dbo.experts
     WHERE user_id = @0 AND [type] = 'vet' AND [status] = 'approved'`,
    [Number(req.user.id)],
  );
  if (!rows[0]) {
    throw new ApiError(403, 'Chỉ bác sĩ thú y đã được duyệt mới thực hiện được', 'FORBIDDEN');
  }
  req.vet = rows[0];
  return next();
});

module.exports = { requireApprovedVet };
