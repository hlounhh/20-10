# 20-10 — Thiệp tương tác và kho ảnh toàn màn hình

Website tĩnh gồm thiệp chúc mừng với nhận diện cử chỉ MediaPipe và thư viện ảnh chỉ xem.

## Trang kho ảnh `/gallery.html`

- Chỉ có lưới ảnh vuông nền tối **phủ toàn bộ khung nhìn**, không thanh công cụ hay ô dấu +.
- Tự tính số hàng theo chiều cao màn hình và số ô trống tối thiểu để che kín chiều ngang; không còn khoảng trống lớn dưới hai hàng ảnh.
- Cuộn ngang bằng cơ chế native của trình duyệt (`overflow-x: auto`, quán tính trên iOS), không có JS theo dõi cuộn. Chạm ảnh để xem lớn, vuốt trái/phải khi xem.
- File chính: `gallery.html`, `css/gallery.css`, `js/gallery.js`, `js/photos.js`.

## Đưa ảnh vào thư viện

**Người xem không thể upload ảnh.** API `/api/photos` chỉ cho phép `GET`, các yêu cầu `POST` sẽ trả **405**. Không cần `GITHUB_TOKEN` hoặc mật khẩu upload trên Vercel nữa.

Chủ repository thêm ảnh JPG/PNG/WebP qua giao diện GitHub bằng cách tải file vào thư mục `photos/` hoặc `photos/YYYY/MM/`. Ngay sau khi commit lên nhánh `main`, frontend đang mở sẽ tự kiểm tra ảnh mới **mỗi 10 giây** (chỉ khi tab đang hiển thị), không cần tải lại trang. API dùng cache tại edge 10 giây và có thể phục vụ bản cũ thêm 5 giây, nên cập nhật gần thời gian thực nhưng không bảo đảm tức thời. Frontend chỉ bổ sung/cập nhật ô thay đổi, giữ vị trí lướt, trì hoãn cập nhật trong lúc đang vuốt và giữ nguyên ảnh đang xem fullscreen.

Repo là public nên ảnh cũng công khai và có thể được xem qua `raw.githubusercontent.com`; chỉ thêm ảnh khi có quyền sử dụng/chia sẻ. Nếu trước đây đã tạo `GITHUB_TOKEN` chỉ để upload ảnh qua website, hãy thu hồi token đó để giảm rủi ro. Không dùng GitHub Raw làm CDN ảnh quy mô lớn.

## Camera

Vẫn chụp ảnh bằng camera/MediaPipe và hiện thiệp; sau đó có thể **tải ảnh về thiết bị**, không tải ảnh lên GitHub.

## Chạy thử

- `python -m http.server 8000` chỉ phục vụ frontend, không có API.
- `npx vercel dev` chạy cả trang và API đọc ảnh.
- Camera hoạt động khi dùng HTTPS hoặc localhost.

## Lưu ý về tần suất đồng bộ

- `js/gallery.js`: `REFRESH_MS = 10000`; đồng bộ ngay khi quay lại tab.
- `api/photos.js`: edge cache `s-maxage=10, stale-while-revalidate=5` hạn chế request vào GitHub.
- GitHub API ẩn danh có giới hạn lượt gọi; với lưu lượng cao nên dùng `GITHUB_TOKEN` **read-only** làm biến môi trường Vercel (không phải token upload) hoặc tăng khoảng polling/cache. API vẫn không hỗ trợ POST.
