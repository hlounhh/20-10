# 20-10 — Thiệp tương tác và kho ảnh toàn màn hình

Website tĩnh gồm thiệp chúc mừng với nhận diện cử chỉ MediaPipe và thư viện ảnh chỉ xem.

## Trang kho ảnh `/gallery.html`

- Chỉ có lưới ảnh vuông nền tối **phủ toàn bộ khung nhìn**, không thanh công cụ hay ô dấu +.
- Tự tính số hàng theo chiều cao màn hình và số ô trống tối thiểu để che kín chiều ngang; không còn khoảng trống lớn dưới hai hàng ảnh.
- Cuộn ngang bằng cơ chế native của trình duyệt (`overflow-x: auto`, quán tính trên iOS), không có JS theo dõi cuộn. Chạm ảnh để xem lớn, vuốt trái/phải khi xem.
- File chính: `gallery.html`, `css/gallery.css`, `js/gallery.js`, `js/photos.js`.

## Đưa ảnh vào thư viện

**Trang gallery không có nút thêm ảnh.** Chỉ sau khi người dùng chụp bằng camera, xem thiệp và nhấn **Cóooooo!** tại câu hỏi chia sẻ, frontend mới gửi ảnh qua `POST /api/photos`. Nút **Không** đóng hộp thoại, không gửi dữ liệu. API `GET /api/photos` vẫn tự động tải danh sách ảnh.

Chủ repository thêm ảnh JPG/PNG/WebP qua giao diện GitHub bằng cách tải file vào thư mục `photos/` hoặc `photos/YYYY/MM/`. Ngay sau khi commit lên nhánh `main`, frontend đang mở sẽ tự kiểm tra ảnh mới **mỗi 10 giây** (chỉ khi tab đang hiển thị), không cần tải lại trang. API dùng cache tại edge 10 giây và có thể phục vụ bản cũ thêm 5 giây, nên cập nhật gần thời gian thực nhưng không bảo đảm tức thời. Frontend chỉ bổ sung/cập nhật ô thay đổi, giữ vị trí lướt, trì hoãn cập nhật trong lúc đang vuốt và giữ nguyên ảnh đang xem fullscreen.

Repo là public nên ảnh cũng công khai và có thể được xem qua `raw.githubusercontent.com`; chỉ thêm ảnh khi có quyền sử dụng/chia sẻ. **Để bật chia sẻ từ camera**, cần đặt `GITHUB_TOKEN` là fine-grained token có quyền **Contents: Read and write** cho riêng repo `hlounhh/20-10` trong **Vercel Environment Variables**, rồi redeploy. Token không được đưa vào frontend. Không yêu cầu mật khẩu người dùng. Không dùng GitHub Raw làm CDN ảnh quy mô lớn.

## Camera

Vẫn chụp ảnh bằng camera/MediaPipe và hiện thiệp. Sau khi người dùng chạm thiệp sẽ hiện câu hỏi **có muốn chia sẻ ảnh cho mọi người không?**: chọn **Không** thì ảnh không được gửi đi; chọn **Cóooooo!🌸** thì ảnh được tải lên GitHub và chuyển đến gallery. Nếu API lỗi, giữ hộp thoại cho phép thử lại.

## Chạy thử

- `python -m http.server 8000` chỉ phục vụ frontend, không có API.
- `npx vercel dev` chạy cả trang và API đọc ảnh.
- Camera hoạt động khi dùng HTTPS hoặc localhost.

## Lưu ý về tần suất đồng bộ

- `js/gallery.js`: `REFRESH_MS = 10000`; đồng bộ ngay khi quay lại tab.
- `api/photos.js`: edge cache `s-maxage=10, stale-while-revalidate=5` hạn chế request vào GitHub.
- GitHub API ẩn danh có giới hạn lượt gọi; khi cần chia sẻ ảnh qua camera, đặt `GITHUB_TOKEN` **Contents: Read and write** ở Vercel. API hỗ trợ `POST` để lưu ảnh chỉ khi frontend gọi sau thao tác đồng ý. **Đây không phải cơ chế xác thực phía server**: người khác có thể tự gọi endpoint công khai. Kiểm tra Origin, giới hạn kích thước và định dạng giúp giảm một số rủi ro nhưng không chống spam. Hãy bật Vercel Firewall / rate limit cho POST trước khi chia sẻ rộng rãi.

**Cảnh báo vận hành:** Mỗi ảnh upload tạo commit trong repo. Nếu token upload cũ đã được thu hồi, cần tạo token mới và redeploy Vercel. Không có token thì gallery vẫn xem được ảnh cũ, nhưng chia sẻ mới sẽ báo lỗi.
