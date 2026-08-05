export type Level = "medium" | "strong" | "max";

const STRENGTH_PARAMS: Record<Level, { rSmall: number; aSmall: number; aBig: number }> = {
  medium: { rSmall: 1, aSmall: 0.35, aBig: 0.5 },
  strong: { rSmall: 1, aSmall: 0.6, aBig: 0.8 },
  max: { rSmall: 2, aSmall: 0.9, aBig: 1.1 },
};

function clampI(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

export async function processVideoClientSide(
  file: File,
  targetLongEdge: number,
  level: Level,
  onProgress: (label: string, pct: number) => void
): Promise<Blob> {
  onProgress("Đang nạp video...", 3);
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Không đọc được video."));
  });

  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  const scale = targetLongEdge / Math.max(srcW, srcH);
  const dstW = Math.round((srcW * scale) / 2) * 2;
  const dstH = Math.round((srcH * scale) / 2) * 2;
  const duration = video.duration;

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const stream = (canvas as any).captureStream(30);
  let mimeType = "video/webm;codecs=vp9";
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "video/webm;codecs=vp8";
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "video/webm";

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 14_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const recordDone = new Promise<void>((res) => {
    recorder.onstop = () => res();
  });

  const p = STRENGTH_PARAMS[level];
  const frameRadius = Math.max(1, Math.min(3, p.rSmall + (level === "max" ? 1 : 0)));
  const frameAmount = p.aSmall + p.aBig * 0.35;

  function sharpenFrame() {
    const imgData = ctx.getImageData(0, 0, dstW, dstH);
    const w = dstW,
      h = dstH,
      n = w * h;
    const src = imgData.data;
    const gray = new Float32Array(n * 3);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      gray[i * 3] = src[j];
      gray[i * 3 + 1] = src[j + 1];
      gray[i * 3 + 2] = src[j + 2];
    }
    const tmp = new Float32Array(gray.length);
    const norm = 1 / (frameRadius * 2 + 1);
    for (let y = 0; y < h; y++) {
      const row = y * w * 3;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let x = -frameRadius; x <= frameRadius; x++) sum += gray[row + clampI(x, 0, w - 1) * 3 + c];
        for (let x = 0; x < w; x++) {
          tmp[row + x * 3 + c] = sum * norm;
          sum +=
            gray[row + clampI(x + frameRadius + 1, 0, w - 1) * 3 + c] -
            gray[row + clampI(x - frameRadius, 0, w - 1) * 3 + c];
        }
      }
    }
    const blurred = new Float32Array(gray.length);
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let y = -frameRadius; y <= frameRadius; y++) sum += tmp[(clampI(y, 0, h - 1) * w + x) * 3 + c];
        for (let y = 0; y < h; y++) {
          blurred[(y * w + x) * 3 + c] = sum * norm;
          sum +=
            tmp[(clampI(y + frameRadius + 1, 0, h - 1) * w + x) * 3 + c] -
            tmp[(clampI(y - frameRadius, 0, h - 1) * w + x) * 3 + c];
        }
      }
    }
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        const idx = i * 3 + c;
        const v = gray[idx] + (gray[idx] - blurred[idx]) * frameAmount;
        src[i * 4 + c] = clampI(Math.round(v), 0, 255);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  onProgress("Đang phát lại & làm nét từng khung hình...", 8);
  recorder.start();
  await video.play();

  await new Promise<void>((res) => {
    function draw() {
      if (video.ended || video.paused) return;
      ctx.drawImage(video, 0, 0, dstW, dstH);
      sharpenFrame();
      const pct = 8 + Math.min(88, (video.currentTime / duration) * 88);
      onProgress("Đang phát lại & làm nét từng khung hình...", pct);
      requestAnimationFrame(draw);
    }
    draw();
    video.onended = () => res();
  });

  recorder.stop();
  await recordDone;
  URL.revokeObjectURL(url);

  onProgress("Đang ghép file kết quả...", 96);
  const blob = new Blob(chunks, { type: "video/webm" });
  onProgress("Hoàn tất", 100);
  return blob;
}
