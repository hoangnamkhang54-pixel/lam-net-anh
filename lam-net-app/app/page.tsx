"use client";

import { useRef, useState, useCallback } from "react";
import { processVideoClientSide, Level } from "./lib/videoProcessor";

const RES_OPTIONS = [
  { value: 1080, label: "1080p", dims: "1920×1080" },
  { value: 1440, label: "2K", dims: "2560×1440" },
  { value: 2160, label: "4K", dims: "3840×2160" },
  { value: 4320, label: "8K", dims: "7680×4320" },
];

const STRENGTH_OPTIONS: { value: Level; label: string; desc: string }[] = [
  { value: "medium", label: "Vừa", desc: "Unsharp 1 lớp bán kính. Tự nhiên, ít hạt." },
  { value: "strong", label: "Mạnh", desc: "Unsharp 2 lớp bán kính. Cân bằng nét/tự nhiên." },
  { value: "max", label: "Cực mạnh", desc: "2 lớp bán kính + khuếch đại biên. Nét tối đa." },
];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"image" | "video" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [targetLong, setTargetLong] = useState(2160);
  const [level, setLevel] = useState<Level>("max");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [stageLabel, setStageLabel] = useState("Đang chờ file...");
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
      alert("Chỉ hỗ trợ file ảnh hoặc video.");
      return;
    }
    setFile(f);
    setFileType(f.type.startsWith("image/") ? "image" : "video");
    setPreviewUrl(URL.createObjectURL(f));
    setDone(false);
    setError(null);
    setDownloadUrl(null);
    setPct(0);
    setStageLabel("Đang chờ file...");
  }, []);

  function clearFile() {
    setFile(null);
    setFileType(null);
    setPreviewUrl(null);
    setDone(false);
    setError(null);
    setDownloadUrl(null);
    setPct(0);
    setStageLabel("Đang chờ file...");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function runImageBackend(f: File) {
    setStageLabel("Đang tải ảnh lên server...");
    setPct(5);

    const form = new FormData();
    form.append("file", f);
    form.append("targetLong", String(targetLong));
    form.append("level", level);

    const blob: Blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/process-image");
      xhr.responseType = "blob";
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const uploadPct = 5 + (e.loaded / e.total) * 40;
          setPct(uploadPct);
          setStageLabel("Đang tải ảnh lên server...");
        }
      };
      xhr.onprogress = () => {
        setStageLabel("Server đang resize + unsharp mask (sharp/libvips)...");
        setPct((p) => Math.min(92, Math.max(p, 50)));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response);
        } else {
          try {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const parsed = JSON.parse(reader.result as string);
                reject(new Error(parsed.error || `Lỗi server (${xhr.status})`));
              } catch {
                reject(new Error(`Lỗi server (${xhr.status})`));
              }
            };
            reader.readAsText(xhr.response);
          } catch {
            reject(new Error(`Lỗi server (${xhr.status})`));
          }
        }
      };
      xhr.onerror = () => reject(new Error("Không kết nối được tới server."));
      xhr.send(form);
    });

    setPct(96);
    setStageLabel("Đang nhận kết quả...");
    return blob;
  }

  async function handleRun() {
    if (!file || !fileType || busy) return;
    setBusy(true);
    setDone(false);
    setError(null);
    setDownloadUrl(null);

    try {
      let blob: Blob;
      let ext: string;

      if (fileType === "image") {
        blob = await runImageBackend(file);
        ext = "png";
      } else {
        blob = await processVideoClientSide(file, targetLong, level, (label, p) => {
          setStageLabel(label);
          setPct(p);
        });
        ext = "webm";
      }

      const url = URL.createObjectURL(blob);
      const resLabel = RES_OPTIONS.find((r) => r.value === targetLong)?.label ?? String(targetLong);
      const base = file.name.replace(/\.[^.]+$/, "");
      setDownloadUrl(url);
      setDownloadName(`${base}_${resLabel}_${level}.${ext}`);
      setPct(100);
      setStageLabel("Hoàn tất");
      setDone(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Lỗi xử lý không xác định.");
      setStageLabel("Lỗi xử lý");
    } finally {
      setBusy(false);
    }
  }

  const vfClass = `viewfinder ${drag ? "drag" : ""} ${busy ? "busy" : ""} ${done ? "done" : ""}`;

  return (
    <div className="stage">
      <div className="telemetry mono">
        <span className="rec">
          <span className="dot" />
          {fileType === "image" ? "BACKEND · SHARP/LIBVIPS" : "CLIENT-SIDE"}
        </span>
        <span>{busy ? "ĐANG XỬ LÝ" : done ? "HOÀN TẤT" : "SẴN SÀNG"}</span>
        <span>{RES_OPTIONS.find((r) => r.value === targetLong)?.label}</span>
      </div>

      <div className="hero">
        <div className="eyebrow">TRẠM XỬ LÝ HẬU KỲ · NEXT.JS</div>
        <h1>
          Làm nét ảnh &amp; video <span>flycam</span>
        </h1>
        <p className="sub">
          Ảnh được resize (Lanczos3) và unsharp mask trên server bằng <b>sharp</b> (libvips) —
          nét và nhanh hơn hẳn xử lý bằng JS trên trình duyệt. Video vẫn xử lý ngay trên máy bạn
          vì hàm serverless không hợp để encode video dài.
        </p>
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>01 · NGUỒN VÀO</span>
          <span>{fileType ? (fileType === "image" ? "ẢNH" : "VIDEO") : "CHƯA CÓ FILE"}</span>
        </div>

        <div
          className={vfClass}
          onClick={() => !busy && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
          }}
        >
          <div className="bracket tl" />
          <div className="bracket tr" />
          <div className="bracket bl" />
          <div className="bracket br" />
          <div className="scanline" />

          {!previewUrl && (
            <div className="vf-empty">
              <div className="icon">⌁</div>
              <div className="main">Kéo thả ảnh hoặc video vào đây</div>
              <div className="hint">hoặc bấm để chọn file · JPG, PNG, MP4, MOV, WEBM</div>
            </div>
          )}
          {previewUrl && fileType === "image" && (
            <img className="vf-media" src={previewUrl} alt="preview" />
          )}
          {previewUrl && fileType === "video" && (
            <video className="vf-media" src={previewUrl} muted autoPlay loop playsInline />
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={(e) => {
            if (e.target.files?.length) handleFile(e.target.files[0]);
          }}
        />

        {file && (
          <div className="file-strip mono">
            <span>
              NGUỒN: <span className="name">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span>
            </span>
            <button className="clear" onClick={clearFile}>
              gỡ file
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>02 · ĐỘ PHÂN GIẢI ĐÍCH</span>
          <span>{RES_OPTIONS.find((r) => r.value === targetLong)?.label}</span>
        </div>
        <div className="res-grid">
          {RES_OPTIONS.map((r) => (
            <div
              key={r.value}
              className={`opt-btn ${targetLong === r.value ? "active" : ""}`}
              onClick={() => setTargetLong(r.value)}
            >
              <div className="label">{r.label}</div>
              <div className="dims">{r.dims}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>03 · CƯỜNG ĐỘ LÀM NÉT</span>
          <span>{STRENGTH_OPTIONS.find((s) => s.value === level)?.label.toUpperCase()}</span>
        </div>
        <div className="strength-grid">
          {STRENGTH_OPTIONS.map((s) => (
            <div
              key={s.value}
              className={`str-btn ${level === s.value ? "active" : ""}`}
              onClick={() => setLevel(s.value)}
            >
              <div className="label">{s.label}</div>
              <div className="desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>04 · XỬ LÝ</span>
        </div>

        <div className="progress-wrap">
          <div className="progress-label">
            <span className={error ? "badge-err" : ""}>{error ? `Lỗi: ${error}` : stageLabel}</span>
            <span>{Math.round(pct)}%</span>
          </div>
          <div className="progress-track">
            <div className={`progress-fill ${done ? "done" : ""}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="shutter-row">
          <button className="shutter" disabled={!file || busy} onClick={handleRun} />
          <div className="shutter-text">
            Bấm để {fileType === "video" ? "xử lý video ngay trên máy bạn" : "gửi ảnh lên server xử lý"}.
            Ảnh 8K + Cực mạnh vẫn nhanh nhờ chạy trên server; video vẫn mất khoảng đúng thời lượng gốc.
          </div>
        </div>

        {downloadUrl && (
          <div className="download-row">
            <a className="dl-btn" href={downloadUrl} download={downloadName}>
              ⭳ Tải kết quả về máy
            </a>
          </div>
        )}
      </div>

      <div className="notes">
        <b>Giới hạn thật:</b> server dùng sharp/libvips — thuật toán resize + sharpen chuẩn công
        nghiệp, chất lượng cao hơn hẳn JS viết tay chạy trên trình duyệt, nhưng vẫn là xử lý số
        (không phải AI vẽ thêm chi tiết). Ảnh mờ do rung tay/lệch focus/thiếu sáng thì chi tiết đã
        mất không thể phục hồi bằng cách này. Trên gói Vercel Hobby, hàm API có giới hạn ~10 giây và
        payload ~4.5MB — ảnh rất lớn hoặc mạng chậm có thể cần nâng lên gói Pro (xem README).
      </div>
    </div>
  );
}
