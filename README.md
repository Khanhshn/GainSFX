# GainSFX v1.4 — Khôi phục chức năng

Website HTML/CSS/JS tĩnh, dùng Supabase Auth, Postgres và Storage cho đăng nhập và SFX tải lên.

## Đã sửa
- Khôi phục đầy đủ 18 MP3 mẫu từ phiên bản 1.3 trước khi bị thay thế bằng âm thanh giả lập trong JS.
- Khôi phục trình phát có tua, âm lượng, tải tệp MP3, yêu thích, tìm kiếm từ khóa và so khớp cơ bản từ micro/tệp tham chiếu.
- Khôi phục giao diện tương thích máy tính / điện thoại và form đăng nhập/email/Google, upload Public/Private.
- Khôi phục bộ tích hợp Supabase và publishable key (không bao giờ để secret/service-role trong code).

## Triển khai
Netlify: kết nối GitHub `Khanhshn/GainSFX`, production branch `main`, publish directory `.`; không cần build command.

## Xác thực
Supabase Project `kqjbhqmaecdalxxjtjlz` đã có `profiles`, `sounds`, bucket `sfx-public`, `sfx-private`, RLS.
Đăng nhập Google cần người quản trị cấu hình OAuth Client ID/Secret trong Supabase & Google Cloud.
Site URL & Redirect URLs phải bao gồm https://gainsfx.netlify.app.
Admin được cấp riêng bằng lệnh quản trị SQL, không tự gán trong trình duyệt.

## Để kiểm thử
Chạy `node --check app.js`, `node --check cloud.js`, `node --check catalog.js` và `python3 tests/check_assets.py`.
Ứng dụng yêu cầu HTTPS/localhost để dùng micro.

## Lưu ý
Các MP3 demo được tổng hợp, không phải bản thu thực tế. Tìm bằng micro sử dụng đặc trưng phổ tần, không phải mô hình nhận dạng AI.
Nếu trình duyệt không tải được thư viện Supabase JS từ CDN, ứng dụng vẫn có thể tìm/nghe/tải bộ MP3 demo; đăng nhập/tải lên sẽ tạm không hoạt động.
