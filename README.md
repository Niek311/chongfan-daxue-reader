# 重返大学：她们都想圈养我 - Web Reader & Markdown Kho Lưu Trữ

Kho lưu trữ toàn bộ **1.101 chương** tiểu thuyết **《重返大学：她们都想圈养我》** (Tác giả: 秋收十月) được trích xuất từ file PDF gốc và xây dựng sẵn **Web Reader** tối ưu để đọc trực tiếp trên **Google Chrome iOS** (iPhone, iPad) và máy tính thông qua **GitHub Pages**.

---

## 📱 Cách đọc truyện trên Google Chrome iOS (iPhone / iPad)

### Bước 1: Đưa dự án lên GitHub
1. Mở trang web [GitHub](https://github.com/) và tạo một repository mới (ví dụ đặt tên là `chongfan-daxue-reader`, chọn Public).
2. Mở Terminal / PowerShell tại thư mục dự án này và chạy các lệnh:
   ```bash
   git init
   git add .
   git commit -m "feat: trích xuất 1101 chương và hoàn thiện iOS Chrome web reader"
   git branch -M main
   git remote add origin https://github.com/<tên_tài_khoản_github>/chongfan-daxue-reader.git
   git push -u origin main
   ```

### Bước 2: Bật GitHub Pages (Miễn phí)
1. Trên giao diện GitHub của repository, vào mục **Settings** -> chọn tab **Pages** (ở cột bên trái).
2. Tại mục **Build and deployment** -> **Branch**:
   - Chọn nhánh: **`main`**
   - Chọn thư mục: **`/ (root)`**
   - Bấm **Save**.
3. Chờ khoảng 1 - 2 phút, GitHub sẽ cung cấp đường link đọc truyện:
   👉 `https://<tên_tài_khoản_github>.github.io/chongfan-daxue-reader/`

### Bước 3: Mở trên Google Chrome iOS
1. Mở app **Google Chrome** trên iPhone / iPad.
2. Dán đường link GitHub Pages của bạn vào thanh địa chỉ để đọc.
3. **Mẹo hay**: Bấm vào nút chia sẻ (Share) -> chọn **"Thêm vào Màn hình chính" (Add to Home Screen)** để biến trang web thành một ứng dụng đọc truyện độc lập, mượt mà và toàn màn hình!

---

## ✨ Các tính năng nổi bật của Web Reader

- 📖 **100% Đầy đủ 1.101 Chương**: Dữ liệu chuẩn, ngắt đoạn tự nhiên, đã lọc sạch số trang và watermark.
- 🎨 **4 Chế độ đọc (Theme)**:
  - 📜 **羊皮纸 (Sepia)**: Màu giấy cổ điển, dịu mắt (Mặc định).
  - ☀️ **明亮白 (Light)**: Nền trắng tinh tế, sắc nét.
  - 🌙 **暗夜黑 (Dark / OLED)**: Tiết kiệm pin và bảo vệ mắt ban đêm.
  - 🍃 **护眼绿 (Green)**: Tone xanh thảo mộc thư giãn.
- 🔍 **Mục lục thông minh**:
  - Tìm kiếm chương theo từ khóa hoặc số chương (`500`, `200`, `1101`).
  - Thanh phím tắt nhảy nhanh (Jump chips).
- 💾 **Tự động lưu tiến độ**:
  - Tự động ghi nhớ chương đang đọc vào `localStorage` của trình duyệt. Mở lại trình duyệt là đọc tiếp ngay.
- 🔠 **Tùy biến typography**:
  - Tăng / giảm cỡ chữ linh hoạt từ 14px đến 32px.
  - Tùy chọn khoảng cách dòng: Chuẩn, Thoáng, Gọn.
  - Chuyển đổi giữa font Sans-serif (Hắc thể) và Serif (Tống thể/Khải thể).
- ⚡ **Tốc độ tải siêu tốc**: Tải bất đồng bộ từng chương dạng JSON và pre-fetch trước chương tiếp theo để chuyển chương tức thì không có độ trễ.
- 📁 **1.101 File Markdown riêng biệt**: Thư mục `chapters/` chứa đầy đủ từng file `.md` từ `chapter_0001.md` đến `chapter_1101.md` để bạn có thể xem trực tiếp ngay trên app GitHub.

---

## 📂 Cấu trúc thư mục

```
chongfan-daxue-reader/
├── chapters/              # 1.101 file Markdown (.md) từng chương riêng biệt
│   ├── chapter_0001.md
│   ├── chapter_0002.md
│   └── ...
├── data/
│   ├── book.json          # Metadata & Danh mục mục lục 1.101 chương
│   └── chapters/          # 1.101 file JSON nội dung chương cho Web Reader
│       ├── 1.json
│       ├── 2.json
│       └── ...
├── index.html             # Giao diện chính của Web Reader
├── app.css                # CSS thiết kế tối ưu cho iOS Retina & Responsive
├── app.js                 # Bộ điều khiển chuyển chương, lưu tiến độ, tìm kiếm
├── manifest.json          # Cấu hình PWA Web App cho iOS / Android
├── extract.py             # Script Python trích xuất PDF tự động
└── README.md
```
