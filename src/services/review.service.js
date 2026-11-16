// Service đánh giá chuyên viên (RVW-01, RVW-02).
// Logic giữ nguyên bản node-mssql đã giao 28/10, chỉ đổi tầng truy vấn từ SQL thô
// sang TypeORM theo rules.md §3.
// Khớp schema thật dbo.expert_reviews / dbo.experts (xem docs/schema-assumptions.md
// mục 8): tính lại experts.rating và rating_count (không phải rating_avg), khi
// liệt kê chỉ lấy review status='approved', join tên khách qua dbo.users.full_name.
const { AppDataSource } = require('../config/data-source');
const reviewRepository = require('../repositories/review.repository');
const ApiError = require('../utils/ApiError');

// RVW-01: khách đánh giá chuyên viên sau dịch vụ.
// Điều kiện: booking phải completed, thuộc về khách này, và chưa từng được review
// (schema đã có UNIQUE(booking_id) nên DB cũng chặn trùng).
// Sau khi lưu review, tính lại rating + số lượt của chuyên viên (trong 1 transaction),
// chỉ tính các review đã approved.
async function createReview(customerId, bookingId, body) {
  return await AppDataSource.transaction(async (manager) => {
    const booking = await reviewRepository.findBookingById(bookingId, manager);
    if (!booking) throw new ApiError(404, 'Không tìm thấy lịch hẹn', 'NOT_FOUND');
    if (Number(booking.customer_id) !== Number(customerId)) {
      throw new ApiError(403, 'Chỉ khách đã đặt lịch mới được đánh giá', 'FORBIDDEN');
    }
    if (booking.status !== 'completed') {
      throw new ApiError(409, 'Chỉ đánh giá được khi dịch vụ đã hoàn thành', 'CONFLICT');
    }
    const existed = await reviewRepository.findByBookingId(bookingId, manager);
    if (existed) throw new ApiError(409, 'Lịch hẹn này đã được đánh giá', 'CONFLICT');
    const review = await reviewRepository.createReview(
      {
        booking_id: bookingId,
        expert_id: booking.expert_id,
        customer_id: customerId,
        rating: body.rating,
        comment: body.comment || null,
        status: 'approved',
      },
      manager,
    );
    // Tính lại rating trung bình của chuyên viên từ các review đã approved.
    await reviewRepository.updateExpertRating(booking.expert_id, manager);
    return review;
  });
}

// RVW-02: danh sách review đã approved của chuyên viên (phân trang, lọc theo sao) + thống kê.
async function listExpertReviews(expertId, queryParams) {
  const page = parseInt(queryParams.page, 10) || 1;
  const limit = parseInt(queryParams.limit, 10) || parseInt(queryParams.pageSize, 10) || 10;
  const rating =
    queryParams.rating !== undefined && queryParams.rating !== null && queryParams.rating !== ''
      ? Number(queryParams.rating)
      : null;
  const result = await reviewRepository.listExpertReviews(expertId, {
    rating,
    page,
    limit: Math.min(limit, 100),
  });
  return {
    items: result.items,
    total: result.total,
    stats: result.stats,
    page,
    limit: Math.min(limit, 100),
  };
}

module.exports = { createReview, listExpertReviews };
