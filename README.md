# GainSFX
Website thư viện Sound Effects: tìm kiếm bằng tên, nghe thử, tải xuống, thu âm qua micro, đăng nhập email/Google và tải SFX Public/Private.
## Deploy
Site tĩnh dùng `index.html`, `styles.css`, `catalog.js`, `cloud.js`, `app.js` và Supabase.
Trên Netlify: chọn repo `Khanhshn/GainSFX`, production branch `main`, publish directory `.`. Không cần build command.
## Supabase
Dự án đã nối bằng **Supabase publishable key** (không phải service_role key).
Phải bật Email Provider, Google OAuth (tạo OAuth Client ID/Secret trên Google Cloud) và thêm Site URL/redirect cho https://gainsfx.netlify.app.
Cơ sở dữ liệu có bảng profiles, sounds, bucket sfx-public và sfx-private, RLS.
Tài khoản admin phải được nâng cấp thủ công bởi chủ dự án trong Supabase SQL Editor, không mặc định tự động cấp cho bất cứ ai.
## Âm thanh mẫu
18 mục demo trong catalog được tạo thành audio WAV tổng hợp trong trình duyệt để nghe thử và tải. Đây không phải bộ ghi âm thực tế gốc. Tệp do người dùng tải lên được lưu trên Supabase.
## An toàn
Tuyệt đối không đưa Supabase secret/service_role, database password hoặc Google OAuth Client Secret lên GitHub. Publishable key có thể công khai; quyền dữ liệu phải được kiểm soát bằng RLS.
