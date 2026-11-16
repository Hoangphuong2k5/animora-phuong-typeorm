// Tầng truy vấn CSDL cho pets / pet_vaccinations / audit_logs.
// Chỉ làm việc với TypeORM DataSource, theo đúng mẫu repositories trong rules.md §7.2:
// nhận `manager` khi service chạy trong transaction, nếu không dùng AppDataSource.
const { AppDataSource } = require('../config/data-source');
const {
  PetEntity,
  PetVaccinationEntity,
  AuditLogEntity,
} = require('../entities/pet.entity');

const getPetRepo = (manager) =>
  manager ? manager.getRepository(PetEntity) : AppDataSource.getRepository(PetEntity);
const getVacRepo = (manager) =>
  manager
    ? manager.getRepository(PetVaccinationEntity)
    : AppDataSource.getRepository(PetVaccinationEntity);
const getAuditRepo = (manager) =>
  manager
    ? manager.getRepository(AuditLogEntity)
    : AppDataSource.getRepository(AuditLogEntity);

// Chỉ pet còn active mới được đọc/sửa (xóa mềm qua status, rules.md §8.1).
const findById = async (id, manager = null) => {
  return await getPetRepo(manager).findOne({ where: { id, status: 'active' } });
};

const findByOwnerId = async (ownerId, manager = null) => {
  return await getPetRepo(manager).find({
    where: { owner_id: ownerId, status: 'active' },
    order: { created_at: 'DESC' },
  });
};

const createPet = async (petData, manager = null) => {
  const repo = getPetRepo(manager);
  const pet = repo.create(petData);
  return await repo.save(pet);
};

// Cập nhật từng trường được gửi lên, bỏ qua trường không gửi (giữ giá trị cũ).
const updatePet = async (id, petData, manager = null) => {
  const repo = getPetRepo(manager);
  await repo.update({ id }, petData);
  return await findById(id, manager);
};

const findVaccinationsByPetId = async (petId, manager = null) => {
  return await getVacRepo(manager).find({
    where: { pet_id: petId },
    order: { vaccinated_at: 'DESC' },
  });
};

const createVaccination = async (vacData, manager = null) => {
  const repo = getVacRepo(manager);
  const row = repo.create(vacData);
  return await repo.save(row);
};

const createAuditLog = async (logData, manager = null) => {
  const repo = getAuditRepo(manager);
  const row = repo.create(logData);
  return await repo.save(row);
};

module.exports = {
  findById,
  findByOwnerId,
  createPet,
  updatePet,
  findVaccinationsByPetId,
  createVaccination,
  createAuditLog,
};
