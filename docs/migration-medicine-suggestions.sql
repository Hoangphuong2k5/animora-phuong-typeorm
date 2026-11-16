-- MED-09: bảng đề xuất nhập thuốc chưa có trong Shop.
-- Bảng này KHÔNG có trong schema gốc animora-sqlserver-v0_1.sql (v1.6),
-- nhưng nghiệp vụ MED-09 bắt buộc cần chỗ lưu đề xuất chờ duyệt.
-- Chạy file này trên database Animora trước khi dùng endpoint medicine-suggestions.
IF OBJECT_ID(N'dbo.medicine_suggestions', N'U') IS NULL
CREATE TABLE dbo.medicine_suggestions (
  id                BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_medicine_suggestions PRIMARY KEY,
  suggested_by      BIGINT NULL,
  suggested_by_role NVARCHAR(20) NULL,
  medicine_name     NVARCHAR(300) NOT NULL,
  note              NVARCHAR(MAX) NULL,
  [status]          NVARCHAR(20) NOT NULL DEFAULT N'pending' CONSTRAINT ck_ms_status CHECK ([status] IN (N'pending',N'approved',N'rejected')),
  created_at        DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT fk_ms_user FOREIGN KEY (suggested_by) REFERENCES dbo.users(id) ON DELETE SET NULL
);
GO
