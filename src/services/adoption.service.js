// Service nhận nuôi (ADP-08, ADP-09, ADP-10, ADP-11).
// Logic giữ nguyên bản node-mssql đã giao 28/10, chỉ đổi tầng truy vấn từ SQL thô
// sang TypeORM theo rules.md §3.
// Khớp schema thật dbo.adoption_posts / dbo.adoption_applications / dbo.pets
// (xem docs/schema-assumptions.md mục 4, 15, 16):
// - adoption_applications KHÔNG có shelter_id: trạm sở hữu đơn xác định qua JOIN
//   adoption_posts.shelter_id = user.id (shelter_id tham chiếu users.id, giữ nguyên).
// - applicant_id -> customer_id; KHÔNG có reject_reason, decided_at, handover_at.
// - Trạng thái đơn chỉ có pending/approved/rejected/withdrawn (KHÔNG có handed_over).
// - Bàn giao dùng 2 timestamp handover_shelter_at và handover_customer_at; khi cả hai
//   đều có thì adoption_posts.status = 'adopted' (status tin chỉ có
//   published/adopted/removed).
// - pets KHÔNG có adoption_application_id nên ADP-11 không lưu liên kết pet<->đơn.
const { AppDataSource } = require('../config/data-source');
const adoptionRepository = require('../repositories/adoption.repository');
const petRepository = require('../repositories/pet.repository');
const { toJsonString } = require('./pet.service');
const ApiError = require('../utils/ApiError');

// ADP-08: trạm xem đơn đăng ký nhận nuôi của trạm mình (lọc theo status, phân trang).
async function listMyApplications(user, queryParams) {
  const page = parseInt(queryParams.page, 10) || 1;
  const limit = parseInt(queryParams.limit, 10) || parseInt(queryParams.pageSize, 10) || 10;
  const result = await adoptionRepository.listMyApplications(user.id, {
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

// ADP-09: trạm duyệt / từ chối đơn (chỉ đơn pending, chỉ trạm sở hữu đơn).
// Lưu ý schema: KHÔNG có cột reject_reason/decided_at nên lý do từ chối (nếu client
// gửi kèm) hiện không được lưu — nhóm quyết định có thêm cột hay không
// (xem PHUONG-CONVERSION.md). API vẫn nhận field reject_reason nhưng bỏ qua.
async function decideApplication(user, applicationId, body) {
  const app = await adoptionRepository.findApplicationWithPost(applicationId);
  if (!app) throw new ApiError(404, 'Không tìm thấy đơn đăng ký', 'NOT_FOUND');
  if (Number(app.shelter_id) !== Number(user.id)) {
    throw new ApiError(403, 'Chỉ trạm cứu hộ sở hữu đơn mới được duyệt', 'FORBIDDEN');
  }
  if (app.status !== 'pending') {
    throw new ApiError(409, `Đơn đã ở trạng thái ${app.status}, không duyệt lại được`, 'CONFLICT');
  }
  const decision = body.decision;
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new ApiError(409, "decision chỉ nhận 'approved' hoặc 'rejected'", 'CONFLICT');
  }
  if (decision === 'approved') {
    // Schema có filtered unique index: mỗi tin chỉ có 1 đơn approved.
    // Kiểm tra lại bằng cách đếm đơn approved khác của cùng tin (tránh race
    // với unique index, DB vẫn là chốt chặn cuối).
    const others = await AppDataSource.query(
      `SELECT COUNT(*) AS c FROM dbo.adoption_applications
       WHERE post_id = @0 AND [status] = 'approved'`,
      [Number(app.post_id)],
    );
    if (Number(others[0].c) > 0) {
      throw new ApiError(409, 'Tin này đã có đơn đăng ký được duyệt khác', 'CONFLICT');
    }
  }
  return await adoptionRepository.updateApplicationStatus(applicationId, decision);
}

// ADP-10: xác nhận bàn giao thú cưng.
// Ai được xác nhận: trạm sở hữu đơn HOẶC chính người đăng ký.
// Bên nào xác nhận thì set timestamp của bên đó; khi cả hai đều có thì tin đăng
// chuyển sang 'adopted'. Trạng thái đơn vẫn giữ 'approved' (schema không có
// trạng thái handed_over). Xác nhận lại phía của mình thì không lỗi (idempotent).
async function confirmHandover(user, applicationId) {
  return await AppDataSource.transaction(async (manager) => {
    const app = await adoptionRepository.findApplicationWithPost(applicationId, manager);
    if (!app) throw new ApiError(404, 'Không tìm thấy đơn đăng ký', 'NOT_FOUND');
    const isShelter = user.role === 'shelter' && Number(app.shelter_id) === Number(user.id);
    const isApplicant = user.role === 'customer' && Number(app.customer_id) === Number(user.id);
    if (!isShelter && !isApplicant) {
      throw new ApiError(403, 'Chỉ trạm cứu hộ hoặc người đăng ký mới được xác nhận bàn giao', 'FORBIDDEN');
    }
    if (app.status !== 'approved') {
      throw new ApiError(409, `Chỉ bàn giao được đơn đã duyệt (hiện tại: ${app.status})`, 'CONFLICT');
    }
    const column = isShelter ? 'handover_shelter_at' : 'handover_customer_at';
    const updated = await adoptionRepository.updateApplicationHandover(
      applicationId,
      column,
      manager,
    );
    if (updated.handover_shelter_at && updated.handover_customer_at) {
      await adoptionRepository.updatePostStatus(app.post_id, 'adopted', manager);
    }
    return updated;
  });
}

// ADP-11: khách tạo hồ sơ pet từ thú cưng vừa nhận nuôi.
// Điều kiện: đơn đã approved VÀ cả hai timestamp bàn giao đều có; người tạo chính
// là người đăng ký. Schema không có liên kết pet<->đơn nên không lưu application id.
async function createPetFromAdoption(user, applicationId, body) {
  return await AppDataSource.transaction(async (manager) => {
    const app = await adoptionRepository.findApplicationWithPost(applicationId, manager);
    if (!app) throw new ApiError(404, 'Không tìm thấy đơn đăng ký', 'NOT_FOUND');
    if (Number(app.customer_id) !== Number(user.id)) {
      throw new ApiError(403, 'Chỉ người đăng ký nhận nuôi mới được tạo hồ sơ pet này', 'FORBIDDEN');
    }
    if (app.status !== 'approved' || !app.handover_shelter_at || !app.handover_customer_at) {
      throw new ApiError(409, 'Chỉ tạo hồ sơ pet sau khi đơn đã duyệt và hai bên đã xác nhận bàn giao', 'CONFLICT');
    }
    const post = await adoptionRepository.findPostById(app.post_id, manager);
    const info = post || {};
    if (body.weight !== undefined && body.weight !== null && Number(body.weight) <= 0) {
      throw new ApiError(409, 'Cân nặng phải lớn hơn 0', 'CONFLICT');
    }
    return await petRepository.createPet(
      {
        owner_id: user.id,
        name: body.name || info.pet_name,
        species: body.species || info.species || null,
        breed: body.breed || info.breed || null,
        gender: body.gender || info.gender || 'unknown',
        birth_date: body.birth_date || null,
        weight: body.weight ?? null,
        color: body.color || null,
        avatar: body.avatar || body.avatar_url || null,
        allergies: toJsonString(body.allergies),
        chronic: null,
        status: 'active',
      },
      manager,
    );
  });
}

module.exports = {
  listMyApplications,
  decideApplication,
  confirmHandover,
  createPetFromAdoption,
};
