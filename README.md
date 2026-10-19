# 20-10 — Thiệp tương tác và kho ảnh toàn màn hình

Website tĩnh gồm thiệp chúc mừng với nhận diện cử chỉ MediaPipe và thư viện ảnh chỉ xem.

## Trang kho ảnh `/gallery.html`

- Chỉ có lưới ảnh vuông nền tối **phủ toàn bộ khung nhìn**, không thanh công cụ hay ô dấu +.
- Tự tính số hàng theo chiều cao màn hình và số ô trống tối thiểu để che kín chiều ngang; không còn khoảng trống lớn dưới hai hàng ảnh.
- Cuộn ngang bằng cơ chế native của trình duyệt (`overflow-x: auto`, quán tính trên iOS), không có JS theo dõi cuộn. Chạm ảnh để xem lớn, vuốt trái/phải khi xem.
- File chính: `gallery.html`, `css/gallery.css`, `js/gallery.js`, `js/photos.js`.

## Đưa ảnh vào thư viện

**Người xem không thể upload ảnh.** API `/api/photos` chỉ cho phép `GET`, các yêu cầu `POST` sẽ trả **405**. Không cần `GITHUB_TOKEN` hoặc mật khẩu upload trên Vercel nữa.

Chủ repository thêm ảnh JPG/PNG/WebP qua giao diện GitHub bằng cách tải file vào thư mục `photos/` hoặc `photos/YYYY/MM/`. Sau commit lên nhánh `main`, trang gallery sẽ nhận diện file ảnh tự động (API có cache tối đa một khoảng ngắn).

Repo là public nên ảnh cũng công khai và có thể được xem qua `raw.githubusercontent.com`; chỉ thêm ảnh khi có quyền sử dụng/chia sẻ. Nếu trước đây đã tạo `GITHUB_TOKEN` chỉ để upload ảnh qua website, hãy thu hồi token đó để giảm rủi ro. Không dùng GitHub Raw làm CDN ảnh quy mô lớn.

## Camera

Vẫn chụp ảnh bằng camera/MediaPipe và hiện thiệp; sau đó có thể **tải ảnh về thiết bị**, không tải ảnh lên GitHub.

## Chạy thử

- `python -m http.server 8000` chỉ phục vụ frontend, không có API.
- `npx vercel dev` chạy cả trang và API đọc ảnh.
- Camera hoạt động khi dùng HTTPS hoặc localhost.
