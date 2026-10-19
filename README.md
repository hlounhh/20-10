# 20-10 — Thiệp chúc mừng tương tác

Website tĩnh dùng camera và MediaPipe Hands để nhận diện cử chỉ trái tim, sau đó mở thiệp và cho phép chia sẻ ảnh. Bản refactor này **chỉ tách mã nguồn thành các file nhỏ**, giữ nguyên giao diện, CSS, thuật toán nhận diện, API và nội dung gốc (kể cả lời chúc 8/3 trong phiên bản hiện có).

## Cấu trúc

```
20-10/
├── index.html             # HTML/SVG markup, tải CSS và JS
├── css/
│   ├── base.css           # Reset, font, biến màu
│   ├── camera.css         # Camera, loader, trạng thái và nút chụp
│   ├── scene.css          # Cảnh thiệp, phong bì, hoa, ruy băng
│   └── share.css          # Hộp thoại chia sẻ ảnh
└── js/
    ├── elements.js       # Tham chiếu DOM dùng chung
    ├── main.js           # Điểm khởi chạy, gắn các sự kiện
    ├── handTracking.js   # Camera, MediaPipe, nhận diện cử chỉ
    ├── capture.js        # Chụp ảnh canvas và hiệu ứng flash
    ├── card.js           # Hiển thị/đóng cảnh thiệp
    └── share.js          # Hộp thoại và upload ảnh
```

## Chạy thử ở máy tính

Dự án không yêu cầu npm hay build. Mở terminal ở thư mục repo và chạy:

```bash
python -m http.server 8000
```

Mở `http://localhost:8000`, cho phép camera và kiểm tra Console/Network trong DevTools để debug. Dùng HTTP server thay vì mở `index.html` bằng `file://`, vì các ES modules yêu cầu nguồn hợp lệ. Khi deploy, cần HTTPS để trình duyệt cấp quyền camera.

## Kiểm tra thủ công sau refactor

1. Camera hiển thị và loader biến mất khi có frame đầu tiên.
2. Hai bàn tay ghép trái tim đủ 500 ms kích hoạt chụp.
3. Nút **Chụp thủ công** vẫn dùng được.
4. Phong bì, thiệp, bó hoa và ruy băng hiển thị theo đúng thứ tự.
5. Chạm thiệp sẽ hiện hộp thoại chia sẻ; nút **Không** đóng hộp thoại.
6. Nút **Có** thực hiện quy trình upload cũ (chỉ thử với ảnh được phép chia sẻ).


## Kho ảnh ngang (/gallery.html)

- Dựng 2 hàng ô vuông, vuốt ngang native với cuộn quán tính trên iOS và Android; không dùng thư viện carousel hay animation kéo bằng JS.
- Ô **+** chọn tối đa 10 ảnh; ảnh được co về tối đa 1440px và nén JPEG tại trình duyệt trước khi tải lên.
- Click/tap xem ảnh lớn, vuốt trái/phải để chuyển ảnh; nút mũi tên cho máy tính.
- CSS: `css/gallery.css`. UI: `js/gallery.js`. Client API chung: `js/upload.js`.
- API: `api/photos.js` (Vercel Node.js Function), dùng GitHub Contents REST API ghi ảnh và Git Tree API đọc danh sách.
- Ảnh được lưu trong `photos/YYYY/MM/` của repository và được hiển thị bằng `raw.githubusercontent.com` (đường dẫn đọc ảnh trực tiếp của GitHub). Không dùng jsDelivr, vì điều khoản của CDN đó không cho phép sử dụng như một dịch vụ lưu trữ ảnh upload.

### BẮT BUỘC cấu hình trên Vercel

Vào Vercel → Project → Settings → Environment Variables, thêm:
- `GITHUB_TOKEN`: fine-grained Personal Access Token chỉ cấp **Contents: Read and write** cho repo `hlounhh/20-10`. Token phải được lưu ở phía máy chủ, tuyệt đối không thêm vào JS frontend/repo.
- `GALLERY_UPLOAD_KEY`: mật khẩu dài, khó đoán, mới hoàn toàn, dùng để xác thực các lượt đăng ảnh.
- `GITHUB_REPOSITORY` (tuỳ chọn, mặc định `hlounhh/20-10`), `GITHUB_BRANCH` (tuỳ chọn, mặc định `main`).

Sau khi thêm biến môi trường, **Redeploy** bản production. Nếu thiếu 2 biến bắt buộc, trang thư viện vẫn hiển thị nhưng thao tác đăng ảnh sẽ trả lỗi 503. Không dùng mật khẩu upload cũ từng bị nhúng trong JS công khai. Nên thu hồi credential cũ ở dịch vụ upload trước đó.

> **Riêng tư:** repo là public, mọi ảnh đăng lên có thể được xem/tải bởi bất kỳ ai. Xoá file không đảm bảo xoá lịch sử Git và cache ngoài. Chỉ đăng khi có sự đồng ý của người trong ảnh. Không dùng GitHub làm kho ảnh dung lượng lớn; GitHub Raw không có cam kết SLA CDN ảnh. Khi dự án phát triển, cân nhắc GitHub Pages cho asset tĩnh và object storage (R2/S3/Supabase Storage) cho ảnh do người dùng upload.

### Chạy thử

- Chạy frontend: `python -m http.server 8000`. API serverless sẽ **không chạy** với lệnh này.
- Chạy cả API: `npx vercel dev` (cần đăng nhập Vercel và cấu hình biến môi trường như trên).
- Mở `/gallery.html`, thử cuộn quán tính trên điện thoại, xem ảnh và upload.
- Nút chia sẻ ảnh ở `index.html` đã gọi `/api/photos` thay cho endpoint ngoài; cần mã tải ảnh lên rồi chuyển về trang gallery.

Lưu ý: Ghép file vào GitHub tạo một commit mới cho mỗi ảnh; cách này hợp album nhỏ và demo, không phù hợp làm dịch vụ upload công cộng quy mô lớn. Mã tải ảnh nên giữ riêng tư để tránh spam và lạm dụng GitHub.
