// Tầng truy vấn CSDL cho expert_reviews (RVW-01, RVW-02).
// Chỉ làm việc với TypeORM DataSource, theo đúng mẫu repositories trong rules.md §7.2.
//
// Bảng bookings (của Toàn) và users (tên khách) chỉ đọc bằng raw SQL, không tự
// định nghĩa entity để tránh đụng khi file booking.entity.js / user.* của Toàn
// được thêm vào. Raw SQL TypeORM cho mssql dùng tham số vị trí @0, @1, ...
const { AppDataSource } = require('../config/data-source');
const { ReviewEntity } = require('../entities/review.entity');

const getReviewRepo = (manager) =>
  manager ? manager.getRepository(ReviewEntity) : AppDataSource.getRepository(ReviewEntity);

const findByBookingId = async (bookingId, manager = null) => {
  return await getReviewRepo(manager).findOne({ where: { booking_id: bookingId } });
};

const createReview = async (reviewData, manager = null) => {
  const repo = getReviewRepo(manager);
  const row = repo.create(reviewData);
  return await repo.save(row);
};

// Đọc 1 booking (phục vụ RVW-01: kiểm tra booking completed + thuộc về khách nào).
const findBookingById = async (bookingId, manager = null) => {
  const db = manager || AppDataSource;
  const rows = await db.query(`SELECT * FROM dbo.bookings WHERE id = @0`, [Number(bookingId)]);
  return rows[0] || null;
};

// Tính lại rating + số lượt của chuyên viên từ các review đã approved
// (giữ nguyên câu SQL bản cũ).
const updateExpertRating = async (expertId, manager) => {
  const db = manager || AppDataSource;
  await db.query(
    `UPDATE dbo.experts SET
       rating = (SELECT AVG(CAST(rating AS DECIMAL(4,2))) FROM dbo.expert_reviews
                 WHERE expert_id = @0 AND [status] = 'approved'),
       rating_count = (SELECT COUNT(*) FROM dbo.expert_reviews
                       WHERE expert_id = @0 AND [status] = 'approved')
     WHERE id = @0`,
    [Number(expertId)],
  );
};

// RVW-02: danh sách review đã approved của chuyên viên (phân trang, lọc theo sao)
// + thống kê. Dùng raw SQL vì cần JOIN users lấy tên khách.
const listExpertReviews = async (expertId, { rating, page, limit }) => {
  const offset = (page - 1) * limit;
  const countRows = await AppDataSource.query(
    `SELECT COUNT(*) AS total FROM dbo.expert_reviews r
     WHERE r.expert_id = @0 AND r.status = 'approved' AND (@1 IS NULL OR r.rating = @1)`,
    [Number(expertId), rating === null || rating === undefined ? null : Number(rating)],
  );
  const rows = await AppDataSource.query(
    `SELECT r.*, u.full_name AS customer_name FROM dbo.expert_reviews r
     LEFT JOIN dbo.users u ON u.id = r.customer_id
     WHERE r.expert_id = @0 AND r.status = 'approved' AND (@1 IS NULL OR r.rating = @1)
     ORDER BY r.created_at DESC
     OFFSET @2 ROWS FETCH NEXT @3 ROWS ONLY`,
    [
      Number(expertId),
      rating === null || rating === undefined ? null : Number(rating),
      offset,
      limit,
    ],
  );
  const statsRows = await AppDataSource.query(
    `SELECT COUNT(*) AS total,
       COALESCE(AVG(CAST(rating AS DECIMAL(4,2))), 0) AS avg_rating
     FROM dbo.expert_reviews WHERE expert_id = @0 AND [status] = 'approved'`,
    [Number(expertId)],
  );
  return {
    items: rows,
    total: Number(countRows[0].total),
    stats: statsRows[0],
  };
};

module.exports = {
  findByBookingId,
  createReview,
  findBookingById,
  updateExpertRating,
  listExpertReviews,
};
