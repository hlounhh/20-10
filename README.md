# 20-10 — Thiệp tương tác và kho ảnh toàn màn hình

Website tĩnh gồm thiệp chúc mừng với nhận diện cử chỉ MediaPipe và thư viện ảnh chỉ xem.

## Trang kho ảnh `/gallery.html`

- Chỉ có lưới ảnh vuông **màu hồng phấn nhẹ** phủ toàn bộ khung nhìn, không thanh công cụ hay ô dấu +. Nền và ô ảnh cùng bảng màu pastel; viewer stacked-card cũng được đổi sang hồng phấn.
- Tự tính **cả số hàng và số cột** theo chiều rộng/cao vùng hiển thị. JS truyền **chiều rộng cột bằng pixel** vào CSS thay vì phép `calc()/var()` không tương thích trên một số bản Safari iOS, tránh lỗi ô ảnh bị bó hẹp vào nửa trái màn hình. Hỗ trợ vùng an toàn iPhone khi xoay ngang, giữ nguyên 100dvh và tính lại khi thanh trình duyệt thay đổi kích thước (kể cả khi số hàng/cột không đổi). Lưới luôn chia hết chiều rộng và chiều cao, không lộ cột bị cắt khi đủ ảnh để lấp khung nhìn.
- Ảnh hiện theo **thứ tự cũ → mới**, ảnh đầu tiên ở góc trên trái rồi lần lượt sang **phải theo hàng**, hết hàng mới xuống hàng tiếp theo; khi lấp đầy màn hình, ảnh tiếp tục ở các cột/trang bên phải. Trang lưới vẫn vuốt ngang native trên iOS/Android, kéo-thả chuột PC cũng được. Đã bỏ `tabindex` trên lưới và focus outline toàn màn hình (viền hồng Safari); phím Tab vẫn vào từng ảnh và hiển thị focus ring trên đúng ô ảnh.
- Chạm vào ảnh sẽ mở **một dải card ảnh xếp ngang** (không còn viewer chỉ một ảnh): card giữa lớn/rõ và nằm trên, các card kế bên chồng nhẹ lên nhau, card tự căn giữa khi vuốt/kéo. **Không có mũi tên, số đếm, link ảnh gốc hoặc văn bản hướng dẫn** trong viewer; chỉ giữ nút đóng.
- Viewer dùng `scroll-snap`, cuộn cảm ứng/quán tính native, mouse pointer drag PC, bánh xe/trackpad và phím mũi tên; khi có ảnh mới sẽ giữ ảnh đang xem và trì hoãn đồng bộ để tránh ngắt vuốt.
- File chính: `gallery.html`, `css/gallery.css`, `js/gallery.js`, `js/photos.js`.

## Đưa ảnh vào thư viện

**Trang gallery không có nút thêm ảnh.** Chỉ sau khi người dùng chụp bằng camera, xem thiệp và nhấn **Cóooooo!** tại câu hỏi chia sẻ, frontend mới gửi ảnh qua `POST /api/photos`. Nút **Không** đóng hộp thoại, không gửi dữ liệu. API `GET /api/photos` vẫn tự động tải danh sách ảnh.

Ảnh chia sẻ mới được ghi **trực tiếp vào nhánh `main`, thư mục `photos/`**, với tên `YYYY-MM-DD_HH-mm.jpg` (hoặc `.png`/`.webp` theo định dạng ảnh), tính theo giờ Việt Nam, **không kèm giây hoặc ký tự ngẫu nhiên**. Ví dụ: `photos/2026-10-20_19-35.jpg`. Nếu đã có ảnh cùng tên trong phút đó, API trả `409` và yêu cầu đợi phút sau để không ghi đè; ảnh cũ trong `photos/YYYY/MM/` vẫn được hiển thị. Chủ repo cũng có thể thêm ảnh thủ công vào `photos/`. Ngay sau khi commit lên nhánh `main`, frontend đang mở sẽ tự kiểm tra ảnh mới **mỗi 10 giây** (chỉ khi tab đang hiển thị), không cần tải lại trang. API dùng cache tại edge 10 giây và có thể phục vụ bản cũ thêm 5 giây, nên cập nhật gần thời gian thực nhưng không bảo đảm tức thời. Frontend chỉ nối thêm ô mới vào cuối thứ tự, giữ vị trí lướt, trì hoãn cập nhật trong lúc đang vuốt và giữ nguyên vị trí card đang xem fullscreen.

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

## Cử chỉ trái tim hai tay (bộ nhận diện mới)

- `js/heartGesture.js`: thay điều kiện chỉ dùng 4 đầu ngón bằng kiểm tra hai lòng bàn tay tách nhau, ngón trỏ hướng vào giữa, ngón cái hướng vào trong và xuống, đỉnh chữ V dưới, hai nửa hình cân xứng, độ mở chiều cao/rộng, tỉ lệ tay và tỉ lệ khung video. Không yêu cầu đầu ngón chạm tuyệt đối.
- Giữ cử chỉ đúng **600 ms** và tối thiểu 6 frame. Thiếu một tay reset ngay; rung ngắn dưới 90ms được chấp nhận nhưng không cộng thời gian sai. Mất tín hiệu lâu thì reset.
- Sau khi chụp, phải thả cử chỉ ít nhất 300ms để chụp tiếp. Camera sẽ không tự chụp lại hoặc ghi đè ảnh trong lúc thiệp / hộp hỏi chia sẻ đang mở.
- Phản hồi trên màn hình hướng dẫn chỗ đặt ngón trỏ và ngón cái. Thuật toán chỉ xét bàn tay, không nhận diện khuôn mặt; tình huống gần mặt được từ chối dựa vào **hình học cử chỉ**, không phải xác thực danh tính.
- Kiểm thử hình học và bộ giữ cử chỉ: `node tests/heartGesture.test.mjs`. Tư thế kiểm thử là landmarks **giả lập**, cần thử camera thật trên iPhone/PC và tinh chỉnh ngưỡng theo kết quả.

## Photo Booth — đếm ngược tạo dáng (20/10)

- Khi hệ thống nhận diện trái tim **giữ đúng 600ms**, hoặc khi nhấn **Chụp thủ công**, sẽ bắt đầu **đếm 5→1 trong 5 giây** rồi mới chụp từ luồng video hiện tại.
- Số đếm và lời nhắn tạo dáng nằm trong một **viên kính hồng nhỏ sát đầu màn hình**, không che trung tâm camera. Người dùng **được thả tay tạo dáng** trong thời gian đếm; không phải tiếp tục giữ trái tim.
- Lời nhắn: “Tạo dáng xinh lên nàooo!”, “Bỏ tay xuống, pose nào!”, “Cười thật tươi nha!”, “Nhìn vào camera nhé!”, “Cheeseeee!”. Đồng hồ tính từ `performance.now()`, không phụ thuộc FPS.
- Chỉ có một countdown/chụp tại một thời điểm; bỏ sang tab khác, camera bị tạm dừng/ngắt hay thiệp mở bất thường sẽ hủy countdown. Sau khi chụp vẫn phải thả cử chỉ trước khi trigger tiếp, ảnh không bị ghi đè trong thiệp và modal chia sẻ.
- Giữ nguyên hỏi đồng ý trước khi chia sẻ ảnh lên GitHub; countdown **không upload ảnh**.
- Unit test: `node tests/photoCountdown.test.mjs`.
