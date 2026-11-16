// Service hồ sơ thú cưng + tiêm chủng (PET-01, PET-02, PET-03, PET-05).
// Logic giữ nguyên bản node-mssql đã giao 28/10 (xem README bản đó, mục A.1),
// chỉ đổi tầng truy vấn từ SQL thô sang TypeORM theo rules.md §3:
// controller -> service (nghiệp vụ + transaction) -> repository (TypeORM).
const { AppDataSource } = require('../config/data-source');
const petRepository = require('../repositories/pet.repository');
const ApiError = require('../utils/ApiError');

// Chuẩn hóa giá trị JSON cho cột NVARCHAR(MAX) có CHECK ISJSON (allergies,
// chronic): nhận chuỗi thì giữ nguyên, nhận object/array thì stringify.
function toJsonString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

// BIGINT trong SQL Server trả về dạng chuỗi qua driver mssql (rules.md §8.2),
// nên mọi phép so sánh id đều ép Number() cả hai vế.
function assertPetOwner(pet, userId) {
  if (!pet) throw new ApiError(404, 'Không tìm thấy thú cưng', 'NOT_FOUND');
  if (Number(pet.owner_id) !== Number(userId)) {
    throw new ApiError(403, 'Chỉ chủ sở hữu mới được xem hồ sơ này', 'FORBIDDEN');
  }
  return pet;
}

// PET-01: tạo hồ sơ pet, owner_id luôn là user đang đăng nhập.
const createPet = async (userId, payload) => {
  if (payload.weight !== undefined && payload.weight !== null && Number(payload.weight) <= 0) {
    throw new ApiError(400, 'Cân nặng phải lớn hơn 0', 'BAD_REQUEST');
  }
  return await petRepository.createPet({
    owner_id: userId,
    name: payload.name,
    species: payload.species,
    breed: payload.breed || null,
    gender: payload.gender || 'unknown',
    birth_date: payload.birth_date || null,
    weight: payload.weight ?? null,
    color: payload.color || null,
    avatar: payload.avatar || payload.avatar_url || null,
    allergies: toJsonString(payload.allergies),
    chronic: toJsonString(payload.chronic),
    status: 'active',
  });
};

// PET-02: cập nhật pet, chỉ owner mới được sửa. Đổi cân nặng thì ghi audit_logs
// (action 'UPDATE_WEIGHT') trong cùng transaction với lần cập nhật.
const updatePet = async (userId, petId, payload, ipAddress) => {
  const pet = await petRepository.findById(petId);
  assertPetOwner(pet, userId);
  if (payload.weight !== undefined && payload.weight !== null && Number(payload.weight) <= 0) {
    throw new ApiError(400, 'Cân nặng phải lớn hơn 0', 'BAD_REQUEST');
  }
  const weightChanged =
    payload.weight !== undefined &&
    payload.weight !== null &&
    Number(payload.weight) !== Number(pet.weight);

  const patch = {};
  if (payload.name !== undefined) patch.name = payload.name;
  if (payload.species !== undefined) patch.species = payload.species;
  if (payload.breed !== undefined) patch.breed = payload.breed;
  if (payload.gender !== undefined) patch.gender = payload.gender;
  if (payload.birth_date !== undefined) patch.birth_date = payload.birth_date;
  if (payload.weight !== undefined) patch.weight = payload.weight;
  if (payload.color !== undefined) patch.color = payload.color;
  if (payload.avatar !== undefined || payload.avatar_url !== undefined) {
    patch.avatar = payload.avatar ?? payload.avatar_url;
  }
  if (payload.allergies !== undefined) patch.allergies = toJsonString(payload.allergies);
  if (payload.chronic !== undefined) patch.chronic = toJsonString(payload.chronic);

  return await AppDataSource.transaction(async (manager) => {
    const updated = await petRepository.updatePet(petId, patch, manager);
    if (weightChanged) {
      await petRepository.createAuditLog(
        {
          actor_id: userId,
          action: 'UPDATE_WEIGHT',
          entity_type: 'pet',
          entity_id: petId,
          old_values: JSON.stringify({ weight: pet.weight }),
          new_values: JSON.stringify({ weight: payload.weight }),
          ip_address: ipAddress || null,
        },
        manager,
      );
    }
    return updated;
  });
};

// PET-03: danh sách pet của tôi (chỉ pet còn active).
const listMyPets = async (userId) => {
  return await petRepository.findByOwnerId(userId);
};

// PET-03: chi tiết pet, chỉ owner mới được xem.
const getPetById = async (userId, petId) => {
  const pet = await petRepository.findById(petId);
  assertPetOwner(pet, userId);
  return pet;
};

// PET-05: danh sách tiêm chủng của 1 pet (chỉ owner).
const listVaccinations = async (userId, petId) => {
  const pet = await petRepository.findById(petId);
  assertPetOwner(pet, userId);
  return await petRepository.findVaccinationsByPetId(petId);
};

// PET-05: thêm mũi tiêm (chỉ owner).
const addVaccination = async (userId, petId, payload) => {
  const pet = await petRepository.findById(petId);
  assertPetOwner(pet, userId);
  return await petRepository.createVaccination({
    pet_id: petId,
    vaccine_name: payload.vaccine_name,
    vaccinated_at: payload.vaccinated_at || payload.vaccinated_date || null,
    next_due_date: payload.next_due_date || null,
    note: payload.note || null,
  });
};

// PET-05: cập nhật thông tin dị ứng vào hồ sơ pet (chỉ owner).
const updateAllergies = async (userId, petId, allergies) => {
  const pet = await petRepository.findById(petId);
  assertPetOwner(pet, userId);
  return await petRepository.updatePet(petId, { allergies: toJsonString(allergies) });
};

module.exports = {
  createPet,
  updatePet,
  listMyPets,
  getPetById,
  listVaccinations,
  addVaccination,
  updateAllergies,
  toJsonString,
};
