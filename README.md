# Trọng Phản Đại Học (重返大学：她们都想圈养我) - Web Reader Song Ngữ Trung - Việt

Kho lưu trữ và ứng dụng Web Reader chứa đầy đủ **1.101 chương** tiểu thuyết **《Trở Lại Thời Đại Học: Các Nàng Đều Muốn Nuôi Nhốt Tôi》** (《重返大学：她们都想圈养我》- Tác giả: 秋收十月 / Thu Thu Thập Nguyệt), hỗ trợ **chuyển đổi tức thì (0ms) giữa bản Tiếng Việt, Tiếng Trung và Song Ngữ** trên **Google Chrome iOS** (iPhone/iPad) và máy tính thông qua **GitHub Pages**.

---

## 🌟 Tính năng Nổi Bật

- 🔄 **Chuyển đổi Ngôn ngữ Tức thì (0ms)**:
  - Nút bấm chuyển đổi **🇻🇳 Tiếng Việt**, **🇨🇳 Tiếng Trung** và **📖 Song ngữ** ngay trên thanh tiêu đề và dưới bài đọc.
  - **Không cần tải lại trang**: Cả hai bản dịch đã được nạp sẵn vào bộ nhớ, bấm nút là đổi ngôn ngữ ngay lập tức, giữ nguyên vị trí đang đọc.
- 📖 **100% Đầy đủ 1.101 Chương**: Khớp chuẩn xác từng chương giữa bản Trung và bản Việt.
- 📱 **Tối ưu cho Google Chrome iOS (iPhone / iPad)**:
  - Hỗ trợ Safe Area (tai thỏ / Dynamic Island), cuộn mượt mà.
  - Tự động ẩn thanh điều hướng khi cuộn xuống và hiện lại khi chạm/cuộn lên.
- 🎨 **4 Chế độ đọc (Theme)**:
  - 📜 **Giấy cũ (Sepia)**: Màu vàng dịu mắt đọc ban đêm (Mặc định).
  - ☀️ **Sáng (Light)**: Nền trắng thanh lịch, sắc nét.
  - 🌙 **Ban đêm (Dark / OLED)**: Nền tối tiết kiệm pin.
  - 🍃 **Dịu mắt (Green)**: Tone xanh thảo mộc chống mỏi mắt.
- 🔍 **Mục lục thông minh**: Tìm kiếm chương bằng tiếng Trung hoặc tiếng Việt, phím nhảy nhanh đến các mốc chương.
- 💾 **Tự động lưu tiến độ**: Tự động lưu chương và ngôn ngữ bạn đang đọc vào trình duyệt.

---

## 📱 Hướng dẫn Đọc trên iPhone / iPad (Google Chrome iOS)

1. Mở app **Google Chrome** (hoặc Safari) trên iPhone / iPad.
2. Truy cập đường link:
   👉 **`https://Niek311.github.io/chongfan-daxue-reader/`**
3. **Mẹo đọc toàn màn hình**:
   - Bấm nút **Chia sẻ (Share)** trên trình duyệt.
   - Chọn **"Thêm vào Màn hình chính" (Add to Home Screen)**.
   - Bấm vào biểu tượng ứng dụng trên màn hình chính để đọc toàn màn hình không có thanh địa chỉ!

---

## 📂 Cấu trúc Thư mục

```
chongfan-daxue-reader/
├── chapters/
│   ├── zh/                # 1.101 file Markdown (.md) bản tiếng Trung
│   │   ├── chapter_0001.md
│   │   └── ...
│   └── vi/                # 1.101 file Markdown (.md) bản tiếng Việt
│       ├── chapter_0001.md
│       └── ...
├── data/
│   ├── book.json          # Metadata song ngữ & danh mục 1.101 chương
│   └── chapters/          # 1.101 file JSON song ngữ nạp siêu tốc
│       ├── 1.json
│       └── ...
├── index.html             # Giao diện Web Reader
├── app.css                # CSS thiết kế iOS Retina & Responsive
├── app.js                 # Bộ điều khiển đổi ngôn ngữ, lưu tiến độ
├── manifest.json          # Cấu hình PWA Web App
└── README.md
```
