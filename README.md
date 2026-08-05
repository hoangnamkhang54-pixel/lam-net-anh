# Làm nét ảnh & video flycam

Web app Next.js: nâng độ phân giải + làm nét ảnh/video (ví dụ từ flycam E88 Pro).

- **Ảnh**: xử lý ở **backend** (`app/api/process-image/route.ts`) bằng thư viện `sharp`
  (libvips) — resize Lanczos3 + unsharp mask, nhanh và chất lượng cao hơn xử lý JS thuần trên
  trình duyệt.
- **Video**: xử lý ở **client** (trình duyệt) vì hàm serverless của Vercel giới hạn thời gian
  chạy, không hợp để encode video dài.

## Chạy thử ở máy

```bash
npm install
npm run dev
```

Mở http://localhost:3000

## Đưa code lên GitHub

```bash
cd lam-net-app
git init
git add .
git commit -m "Init: lam net anh video"
git branch -M main
git remote add origin https://github.com/<username>/<ten-repo>.git
git push -u origin main
```

Nếu chưa có repo, tạo trước tại https://github.com/new (để trống, không tick "Initialize with README" để tránh conflict khi push).

## Deploy lên Vercel

**Cách nhanh nhất — qua giao diện web:**
1. Vào https://vercel.com/new
2. Chọn **Import Git Repository**, chọn repo vừa push lên GitHub
3. Vercel tự nhận diện đây là project Next.js — không cần chỉnh gì thêm, bấm **Deploy**
4. Sau khi build xong, bạn có 1 URL dạng `https://ten-repo.vercel.app`

**Hoặc qua CLI:**
```bash
npm i -g vercel
vercel login
vercel        # deploy bản preview
vercel --prod # deploy bản production
```

## Lưu ý giới hạn khi chạy trên Vercel

- **Gói Hobby (miễn phí)**: hàm API mặc định timeout ~10 giây, giới hạn payload request khoảng
  4.5MB. Ảnh lớn (đặc biệt yêu cầu 8K) hoặc mạng upload chậm có thể bị lỗi timeout.
- Để xử lý ảnh lớn thoải mái hơn, cân nhắc:
  - Nâng lên gói **Pro** (timeout tới 60s, payload lớn hơn — file `route.ts` đã có sẵn
    `export const maxDuration = 60`)
  - Hoặc giảm độ phân giải đích / nén ảnh trước khi upload
- Video xử lý hoàn toàn trên trình duyệt người dùng, không đụng tới giới hạn của Vercel, nhưng
  phụ thuộc cấu hình máy/trình duyệt của người dùng.

## Cấu trúc project

```
app/
  page.tsx                     giao diện chính (client component)
  layout.tsx
  globals.css                  toàn bộ style HUD
  lib/videoProcessor.ts        xử lý video phía client (canvas + MediaRecorder)
  api/process-image/route.ts   backend xử lý ảnh bằng sharp
```
