# Chuyển backend phần của Phương sang TypeORM của nhóm — 26 UC

Bản chuyển đổi đầy đủ phần của Phương (Animora, Sprint 3) từ bản node-mssql đã
giao 28/10/2026 sang cấu trúc TypeORM của nhóm (EntitySchema + repository /
service / controller / validator / route theo `backend/rules.md`).

**Trạng thái file:** toàn bộ file nằm trong thư mục chuyển đổi này
(`animora-typeorm-conversion/`), **chưa ghép vào repo nhóm, chưa commit,
chưa push** (theo dặn của Amber ngày 13/11/2026: không thay đổi code trên Git
hiện tại). Muốn dùng thì làm theo 2 file trong `patches/` (hướng dẫn áp dụng)
và đọc mục "Bước tiếp theo" bên dưới.

## 1. Module đã xong (26/26 UC)

| Module | File (đủ 6 tầng) | UC |
|---|---|---|
| pets (đã có từ 06/11) | `pet.*` | PET-01, 02, 03, 05 |
| products | `product.*` (entity gồm products + product_categories) | PRD-01–05 |
| medical | `medical.*` (medical_records); PET-07 gắn trong `medical.route.js` | MED-01, 02, 03 + PET-07 |
| prescriptions | `prescription.*` (prescriptions + prescription_items) | MED-04–08 |
| reviews | `review.*` (bảng expert_reviews) | RVW-01, 02 |
| cash-payment | `payment.entity.js` + `cash-payment.*` | SPAY-05 |
| adoption | `adoption.*` (adoption_posts + adoption_applications) | ADP-08–11 |
| medicine-suggestions | `medicine-suggestion.*` | MED-09 |
| middleware mới | `middlewares/vet.middleware.js` | kiểm tra bác sĩ cho route /vet/... |

Tổng cộng: 6 file pets có sẵn + **43 file mới** (7 module × 6 file + 1 middleware),
2 file patch đã mở rộng cho đủ tất cả module, 1 file migration trong `docs/`.

## 2. Hai quyết định đặt tên file (tránh đụng phần người khác)

1. **Review riêng, không động vào `expert.*` của Hoàng.** Đánh giá chuyên viên
   dùng `review.entity.js` (bảng `expert_reviews`) + `review.*` riêng. Khi file
   `expert.entity.js` của Hoàng được thêm vào, nó cũng có thể khai báo bảng
   `expert_reviews` — lúc đó nhóm chỉ giữ 1 bên (bỏ `ReviewEntity` ở đây, hoặc
   Hoàng không khai báo lại bảng này) để tránh trùng tên entity.
2. **Thu tiền mặt riêng, không động vào `payment.*` của Toàn.** Bảng `payments`
   dùng `payment.entity.js`, nhưng service/controller/route/validator đặt tên
   `cash-payment.*` để không đụng file `payment.*` của Toàn (VNPAY, SPAY-02).
   URL giữ nguyên: `POST /api/v1/experts/me/bookings/:id/cash-payment`.

## 3. Những chỗ giữ nguyên logic bản cũ (không viết lại theo cảm tính)

- **MED-05 versioning đơn thuốc:** đơn cũ → `superseded`, đơn mới `version = cũ + 1`,
  `parent_id = id đơn cũ`, giữ nguyên `medical_record_id`. MED-03 (cập nhật ghi chú
  kèm đơn mới) dùng chung cơ chế này.
- **MED-07/08 đếm lượt mua lại qua `orders.prescription_id`:** số lần đã dùng =
  COUNT orders có `prescription_id` = đơn đó VÀ `status` không phải
  `cancelled`/`returned`. `allow_reorder=1` thì đã dùng < `max_refills`;
  `allow_reorder=0` thì chỉ lượt mua đầu tiên (đúng "severe: mua 1 lần").
  Reorder KHÔNG tự tiêu thụ lượt mua — lượt chỉ tính khi có order.
- **MED-04 bắt buộc `medical_record_id`** (bệnh án phải tồn tại, thuộc về vet này
  và pet này); `severity` mild/severe; severe thì `allow_reorder=0`,
  `max_refills=0` (đúng CHECK của schema).
- **Chống trùng SKU:** app kiểm tra trước khi tạo/sửa sản phẩm (DB có filtered
  unique index `uq_prd_sku` chặn trùng SKU khác NULL).
- **SPAY-05 chống thu trùng:** kiểm tra `booking.payment_status='paid'` và đã có
  payment cash/success/charge; số tiền lấy từ `bookings.total_amount`.
- **PRD-03:** xóa danh mục bị chặn khi còn sản phẩm hoặc danh mục con.
- **RVW-01:** chỉ đánh giá khi booking `completed`, thuộc về khách này, chưa từng
  review (UNIQUE `booking_id`); tính lại `experts.rating` + `rating_count` từ
  review `approved`.
- **ADP-09/10/11:** duyệt/từ chối chỉ đơn `pending` của trạm sở hữu; bàn giao 2
  phía (trạm + người đăng ký) bằng 2 timestamp, cả hai có thì tin → `adopted`;
  tạo pet sau nhận nuôi chỉ khi đơn `approved` và đủ 2 timestamp.
- **MED-02:** `visit_date` lấy ngày từ `bookings.scheduled_at`; `booking_id`
  UNIQUE (1 bệnh án/booking) — tạo trùng trả 409.
- **PET-02 / PRD-05:** đổi cân nặng / sửa sản phẩm vẫn ghi `audit_logs`
  (`UPDATE_WEIGHT` / `UPDATE_PRODUCT`).

## 4. Những chỗ phải rút gọn / thay đổi so với bản node-mssql (và lý do)

1. **Bác sĩ kiểm tra 2 lớp thay vì 1:** bản cũ kiểm tra vet trong service
   (`assertVerifiedVet`). Bản mới kiểm tra ở middleware `requireApprovedVet`
   cho route `/vet/...` (chuẩn nhóm: middleware trước controller), service chỉ
   nhận `vetId` đã kiểm tra. Riêng MED-06 (xem lịch sử đơn, role expert) và
   MED-09 (role expert) vẫn kiểm tra vet trong service vì 2 route này không
   dùng middleware vet.
2. **PET-07 không sửa file `pet.route.js` mẫu:** route
   `GET /api/v1/pets/:id/medical-records` đặt trong `medical.route.js` để giữ
   nguyên 6 file pets đã giao 06/11. URL cuối cùng giống hệt bản cũ.
3. **MED-09 tách khỏi prescriptions:** bản cũ đặt 2 endpoint medicine-suggestions
   trong `prescriptions.routes.js`; bản mới tách thành module
   `medicine-suggestion.*` riêng theo phân công module. URL giữ nguyên.
4. **Phân trang theo chuẩn nhóm:** các danh sách dùng `paginatedResponse`
   (`meta: { page, limit, totalItems, totalPages }`), mặc định `limit=10`
   (bản cũ mặc định `pageSize=20`). Vẫn nhận cả `limit` và `pageSize` ở query.
   Riêng RVW-02 giữ dạng `{ items, pagination, stats }` như bản cũ để không
   mất thống kê rating.
5. **Danh mục xóa cứng (không xóa mềm):** bảng `product_categories` không có cột
   `status` nên không thể đổi status; giữ cách xóa cứng của bản cũ, vẫn chặn
   khi còn sản phẩm/danh mục con. Các bảng khác có `status` thì xóa mềm như
   quy chuẩn (sản phẩm ẩn bằng `status='hidden'` qua PRD-05).
6. **Raw SQL trong repository cho bảng của người khác:** các bảng thuộc phần
   Toàn/Hoàng (`bookings`, `orders`, `carts`, `cart_items`, `experts`, `users`,
   `inventory_batches`) chưa có entity nên repository đọc/ghi bằng raw SQL qua
   TypeORM (`manager.query(...)`, tham số vị trí `@0`, `@1` cho mssql —
   **lưu ý: TypeORM mssql đánh số tham số từ 0, không phải từ 1**; dùng `@1`
   với mảng 1 phần tử sẽ lỗi "Must declare the scalar variable @1".
   Đã kiểm chứng bằng DB thật ngày 13/11/2026 và sửa toàn bộ 63 placeholder
   về `@0`, `@1`, `@2`, `@3`). Khi
   entity của họ được thêm vào, nên thay các câu raw này bằng repository tương
   ứng. Mọi câu raw đều nằm trong `repositories/`, không có SQL trong service.
7. **ID trên URL kiểm tra ở controller:** bản cũ dùng `toIntParam` (sai → 400);
   bản mới kiểm tra `Number.isInteger` ở controller rồi mới gọi service.
8. **Tiền tố route:** `product.route.js` và các route còn lại mang đủ đường dẫn
   tuyệt đối trong file nên được gắn trực tiếp vào router `/api/v1` (không
   tiền tố), giống cách bản cũ mount ở `app.js`. Chỉ `pet.route.js` gắn với
   tiền tố `/pets` như mẫu đã có.

## 5. Migration phải chạy trước (MED-09)

Bảng `dbo.medicine_suggestions` **không có** trong schema gốc v1.6. File
`docs/migration-medicine-suggestions.sql` (copy nguyên từ bản node-mssql) phải
được chạy trên database Animora **trước khi khởi động server**, nếu không
endpoint MED-09 sẽ lỗi "bảng không tồn tại". Các bảng còn lại đã có sẵn từ
`animora-sqlserver-v0_1.sql` (`synchronize: false` nên TypeORM không tự tạo bảng).

## 6. Hai điểm schema nhóm chưa quyết (KHÔNG tự bịa cột)

1. **Lý do từ chối đơn nhận nuôi:** schema không có cột lưu. API ADP-09 vẫn
   nhận field `reject_reason` (đã khai báo trong validator) nhưng hiện
   **không lưu**. Nếu nhóm muốn lưu, cần thêm cột (ví dụ
   `reject_reason NVARCHAR(500)`) vào `dbo.adoption_applications` rồi mở lại
   phần ghi trong `adoption.service.js`.
2. **Liên kết pet ↔ đơn nhận nuôi:** schema không có cột nối. ADP-11 tạo pet
   từ tin nhận nuôi nhưng không lưu lại application id nào đã sinh ra pet đó.
   Nếu nhóm muốn truy vết, cần thêm cột (ví dụ `adoption_application_id`)
   vào `dbo.pets`.

Ngoài ra: **lượt mua lại đếm qua orders** nên luồng checkout của Toàn phải gắn
đúng `prescription_id` vào order khi mua thuốc theo đơn thì số liệu MED-07/08
mới đúng; **MED-04 bắt buộc FE gửi `medical_record_id`** (bệnh án đã tạo ở
MED-02) vì cột này NOT NULL.

## 7. Đã test với DB thật ngày 13/11/2026 (ghi rõ)

Test chạy trên máy này với SQL Server 2022 + database Animora thật (54 bảng
+ bảng `medicine_suggestions` từ migration), backend port 5000, frontend
port 3000 — bản test riêng trong `workspace/animora-localtest/`, **không
động vào code trên Git** (GitHub vẫn commit `6431ec5`).

- Đăng ký / đăng nhập chạy; tạo pet Milu được; xem sản phẩm / dịch vụ trả
  dữ liệu thật từ DB.
- MED-05 versioning đơn thuốc đúng (đơn cũ → `superseded`, đơn mới v2);
  đơn hết hiệu lực bị chặn mua; mua lại được (MED-07/08).
- SPAY-05 chống thu trùng đúng: thu tiền mặt lần 2 bị chặn 409.
- Frontend 6 trang đều load được và đã trỏ đúng về backend local.
- Bug tìm được nhờ test DB thật: tham số raw SQL dùng sai `@1`/`@2` thay vì
  `@0`/`@1` — đã sửa 63 chỗ trong 8 file (xem mục 4.6).
- Các mã lỗi (404/403/409) và envelope
  `{ success:false, message, errorCode, errors }` theo chuẩn nhóm
  (rules.md §6.2).

**Chưa test:**
- Chưa bấm tay đăng nhập trên trình duyệt thật — trình duyệt cloud không tới
  được localhost của máy này, chỉ kiểm tra bằng lệnh gọi API.
- Luồng nhận nuôi ADP-08–11 chưa test hết, cần tài khoản shelter.
- Chưa kiểm tra va chạm tên entity với file `expert.entity.js` /
  `booking.entity.js` / `order.entity.js` / `cart` của Toàn và Hoàng khi họ
  thêm file (xem mục 2 và mục 4.6).
- **Bẫy trong rules.md đã tránh:** ví dụ §7.2 dùng cột `weight_kg` là sai —
  schema thật chỉ có `weight DECIMAL(6,2)`; độ dài cột lấy theo schema thật
  (products.name 150, sku 50, slug 150; categories.name/slug 100; vaccine 100;
  `pet_vaccinations` không có `created_at`; `pets` có thêm `chronic` và
  `color`). Mọi entity trong bản này đều đối chiếu trực tiếp với file
  `animora-sqlserver-v0_1.sql` v1.6.

## 8. Bước tiếp theo để nhóm dùng được

1. Copy toàn bộ file trong `src/` + `docs/` của thư mục này vào
   `Nhom-14/backend/` theo đúng layout (danh sách đầy đủ trong
   `patches/data-source.patch.txt` mục 3).
2. Áp 2 file patch: đăng ký entity vào `src/config/data-source.js` và gắn
   route vào `src/routes/index.js` (làm theo hướng dẫn trong từng file patch).
3. (Tùy chọn) Thêm `SHELTER: 'shelter'` vào `ROLES` trong
   `src/utils/constants.js` rồi đổi `authorizeRoles('shelter')` thành
   `authorizeRoles(ROLES.SHELTER)` trong `adoption.route.js`.
4. Chạy migration `docs/migration-medicine-suggestions.sql` trên database
   Animora (người có quyền DB nhóm chạy).
5. `npm install` (không cần gói mới — repo đã có typeorm, joi, express).
6. Smoke test với DB thật đã chạy một phần ngày 13/11/2026 (xem mục 7):
   MED-05 versioning, MED-07/08 đếm qua orders, SPAY-05 chống thu trùng đều
   đạt. Còn lại: bấm tay đăng nhập trên trình duyệt thật và test ADP-08–11
   (cần tài khoản shelter).
7. Sau khi test đạt, cập nhật 9 task Sprint 3 trên sheet live
   (ADP-08/09/10/11, MED-03/04/05/06/09) từ InProgress → Done. Hạn Sprint 3:
   **30/11/2026**.
