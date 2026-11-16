// Tầng truy vấn CSDL cho adoption_posts / adoption_applications (ADP-08–11).
// Chỉ làm việc với TypeORM DataSource, theo đúng mẫu repositories trong rules.md §7.2.
//
// ADP-08 cần JOIN users lấy tên người đăng ký nên dùng raw SQL (bảng users thuộc
// phần của Toàn, không tự định nghĩa entity ở đây).
// Raw SQL TypeORM cho mssql dùng tham số vị trí @0, @1, ...
const { AppDataSource } = require('../config/data-source');
const {
  AdoptionPostEntity,
  AdoptionApplicationEntity,
} = require('../entities/adoption.entity');

const getPostRepo = (manager) =>
  manager
    ? manager.getRepository(AdoptionPostEntity)
    : AppDataSource.getRepository(AdoptionPostEntity);
const getApplicationRepo = (manager) =>
  manager
    ? manager.getRepository(AdoptionApplicationEntity)
    : AppDataSource.getRepository(AdoptionApplicationEntity);

// Lấy đơn + tin đăng của nó; kiểm tra trạm sở hữu (qua adoption_posts.shelter_id).
const findApplicationWithPost = async (applicationId, manager = null) => {
  const db = manager || AppDataSource;
  const rows = await db.query(
    `SELECT a.*, p.shelter_id, p.pet_name, p.species AS post_species, p.breed AS post_breed
     FROM dbo.adoption_applications a
     LEFT JOIN dbo.adoption_posts p ON p.id = a.post_id
     WHERE a.id = @0`,
    [Number(applicationId)],
  );
  return rows[0] || null;
};

const findPostById = async (postId, manager = null) => {
  return await getPostRepo(manager).findOne({ where: { id: postId } });
};

// ADP-08: trạm xem đơn đăng ký nhận nuôi của trạm mình (lọc theo status, phân trang).
const listMyApplications = async (shelterUserId, { status, page, limit }) => {
  const offset = (page - 1) * limit;
  const countRows = await AppDataSource.query(
    `SELECT COUNT(*) AS total FROM dbo.adoption_applications a
     JOIN dbo.adoption_posts p ON p.id = a.post_id
     WHERE p.shelter_id = @0 AND (@1 IS NULL OR a.status = @1)`,
    [Number(shelterUserId), status || null],
  );
  const rows = await AppDataSource.query(
    `SELECT a.*, p.pet_name, p.species, p.breed, u.full_name AS applicant_name
     FROM dbo.adoption_applications a
     JOIN dbo.adoption_posts p ON p.id = a.post_id
     LEFT JOIN dbo.users u ON u.id = a.customer_id
     WHERE p.shelter_id = @0 AND (@1 IS NULL OR a.status = @1)
     ORDER BY a.created_at DESC
     OFFSET @2 ROWS FETCH NEXT @3 ROWS ONLY`,
    [Number(shelterUserId), status || null, offset, limit],
  );
  return { items: rows, total: Number(countRows[0].total) };
};

const updateApplicationStatus = async (applicationId, status, manager = null) => {
  const db = manager || AppDataSource;
  const rows = await db.query(
    `UPDATE dbo.adoption_applications SET status = @1
     OUTPUT INSERTED.* WHERE id = @0`,
    [Number(applicationId), status],
  );
  return rows[0] || null;
};

// ADP-10: bên nào xác nhận thì set timestamp của bên đó (idempotent: xác nhận
// lại phía của mình thì chỉ cập nhật lại timestamp, không lỗi).
// `column` chỉ nhận 1 trong 2 giá trị cố định do service truyền vào.
const updateApplicationHandover = async (applicationId, column, manager = null) => {
  const db = manager || AppDataSource;
  const rows = await db.query(
    `UPDATE dbo.adoption_applications SET ${column} = SYSUTCDATETIME()
     OUTPUT INSERTED.* WHERE id = @0`,
    [Number(applicationId)],
  );
  return rows[0] || null;
};

const updatePostStatus = async (postId, status, manager = null) => {
  const repo = getPostRepo(manager);
  await repo.update({ id: postId }, { status });
  return await findPostById(postId, manager);
};

module.exports = {
  findApplicationWithPost,
  findPostById,
  listMyApplications,
  updateApplicationStatus,
  updateApplicationHandover,
  updatePostStatus,
};
