import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LÀM NÉT · Trạm xử lý ảnh & video flycam",
  description: "Nâng độ phân giải và làm nét ảnh, video từ flycam. Ảnh xử lý server-side bằng sharp, video xử lý client-side.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
