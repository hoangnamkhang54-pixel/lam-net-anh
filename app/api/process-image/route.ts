import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 60; // giây — cần gói Vercel Pro để chạy quá 10s (Hobby)

type Level = "medium" | "strong" | "max";

// Tham số unsharp mask theo cường độ.
// sigma: bán kính làm mờ tham chiếu (càng lớn càng bắt chi tiết lớn)
// m1/m2: mức khuếch đại vùng tương phản thấp/cao
// x1: ngưỡng chuyển giữa m1 và m2
const STRENGTH: Record<Level, { sigma: number; m1: number; m2: number; x1: number }> = {
  medium: { sigma: 1.3, m1: 1.0, m2: 2.0, x1: 2 },
  strong: { sigma: 1.8, m1: 1.5, m2: 3.0, x1: 2.5 },
  max: { sigma: 2.3, m1: 2.2, m2: 4.5, x1: 3 },
};

const MAX_LONG_EDGE = 7680; // chặn ở mốc 8K để tránh timeout/OOM trên serverless

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const targetLongRaw = form.get("targetLong");
    const levelRaw = form.get("level");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu file ảnh." }, { status: 400 });
    }

    const targetLong = Math.min(
      MAX_LONG_EDGE,
      Math.max(480, parseInt(String(targetLongRaw ?? "2160"), 10) || 2160)
    );
    const level: Level = ["medium", "strong", "max"].includes(String(levelRaw))
      ? (String(levelRaw) as Level)
      : "max";

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    const image = sharp(inputBuffer, { limitInputPixels: false });
    const meta = await image.metadata();
    const srcW = meta.width ?? 1;
    const srcH = meta.height ?? 1;

    const scale = targetLong / Math.max(srcW, srcH);
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const params = STRENGTH[level];

    const outputBuffer = await image
      .resize(dstW, dstH, { kernel: sharp.kernel.lanczos3, fit: "fill" })
      .sharpen({ sigma: params.sigma, m1: params.m1, m2: params.m2, x1: params.x1 })
      .png({ compressionLevel: 8 })
      .toBuffer();

    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="processed.png"',
        "X-Output-Width": String(dstW),
        "X-Output-Height": String(dstH),
      },
    });
  } catch (err: any) {
    console.error("process-image error:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi xử lý ảnh trên server." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    info: "POST multipart/form-data với field: file, targetLong, level",
  });
}
