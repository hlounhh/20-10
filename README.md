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

## Lưu ý bảo mật (có sẵn từ bản gốc)

File `js/share.js` hiện vẫn chứa thông tin xác thực upload ở phía trình duyệt. **Đây không phải nơi an toàn để cất secret**: cần thu hồi/thay mật khẩu đang dùng và thiết kế xác thực ở backend trước khi phát hành công khai. Không chuyển nguyên chuỗi này sang cấu hình frontend rồi coi là đã bảo mật. Refactor này chưa sửa API để tránh phá vỡ tính năng upload hiện tại.
