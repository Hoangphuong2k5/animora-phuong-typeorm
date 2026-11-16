# Backend phần của Phương (Animora) — chuyển sang TypeORM của nhóm

Bản chuyển đổi đầy đủ phần backend của Phương (Animora, Sprint 3, 20/10–30/11/2026) từ bản Node.js + node-mssql đã giao 28/10/2026 sang cấu trúc TypeORM của nhóm (EntitySchema + repository / service / controller / validator / route theo `backend/rules.md`).

## Phạm vi — 26/26 UC

| Module | UC |
|---|---|
| pets | PET-01, 02, 03, 05, 07 |
| products | PRD-01–05 |
| medical | MED-01, 02, 03 |
| prescriptions | MED-04–08 |
| reviews | RVW-01, 02 |
| cash-payment | SPAY-05 |
| adoption | ADP-08–11 |
| medicine-suggestions | MED-09 |

Tổng cộng: 49 file JS (8 module × 6 tầng + 1 middleware), 32 endpoint, khớp bản node-mssql cũ.

## Cách dùng (ghép vào repo nhóm)

1. Copy toàn bộ file trong `src/` + `docs/` vào `Nhom-14/backend/` theo đúng layout (danh sách đầy đủ trong `patches/data-source.patch.txt` mục 3).
2. Áp 2 file trong `patches/`: đăng ký 13 entity vào `src/config/data-source.js` và gắn 8 route vào `src/routes/index.js`.
3. Chạy migration `docs/migration-medicine-suggestions.sql` trên database Animora **trước khi khởi động server** (bảng `medicine_suggestions` không có trong schema gốc v1.6).
4. `npm install` (không cần gói mới — repo nhóm đã có typeorm, joi, express).

Chi tiết đầy đủ trong `PHUONG-CONVERSION.md`.

## Đã test với DB thật (13/11/2026)

Test trên SQL Server 2022 + database Animora thật (54 bảng + bảng `medicine_suggestions`), backend port 5000, frontend port 3000. Đăng ký/đăng nhập, tạo pet, MED-05 versioning đơn thuốc, MED-07/08 mua lại, SPAY-05 chống thu trùng đều đạt. Bug tìm được nhờ test DB thật: tham số raw SQL TypeORM mssql dùng `@0`, `@1` (không phải `@1`, `@2`) — đã sửa 63 chỗ trong 8 file.

## Lưu ý

- Repo này là bản chuyển đổi riêng, **chưa ghép vào repo nhóm**.
- 2 điểm schema nhóm chưa quyết: chỗ lưu lý do từ chối đơn nhận nuôi, và liên kết pet với đơn nhận nuôi (xem `PHUONG-CONVERSION.md` mục 6).
- MED-04 bắt buộc frontend gửi `medical_record_id`; checkout cần gắn đúng `prescription_id` thì MED-07/08 mới đếm đúng.
