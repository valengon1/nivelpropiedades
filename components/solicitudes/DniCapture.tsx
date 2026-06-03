"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Upload, RotateCcw, Check, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Props {
  tipo: "frente" | "dorso";
  currentUrl: string;
  onConfirm: (processedBlob: Blob, previewUrl: string) => void;
  disabled?: boolean;
}

type Point = { x: number; y: number };
type Corners = { tl: Point; tr: Point; br: Point; bl: Point };

// ── Mejoras de imagen ─────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function autoLevels(data: Uint8ClampedArray): void {
  const pct = (arr: number[], p: number) => {
    arr.sort((a, b) => a - b);
    return arr[Math.floor((arr.length - 1) * p)];
  };
  const rV: number[] = [], gV: number[] = [], bV: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    rV.push(data[i]); gV.push(data[i + 1]); bV.push(data[i + 2]);
  }
  const [rLo, rHi] = [pct(rV, 0.01), pct(rV, 0.99)];
  const [gLo, gHi] = [pct(gV, 0.01), pct(gV, 0.99)];
  const [bLo, bHi] = [pct(bV, 0.01), pct(bV, 0.99)];
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = clamp(rHi === rLo ? data[i]     : ((data[i]     - rLo) / (rHi - rLo)) * 255);
    data[i + 1] = clamp(gHi === gLo ? data[i + 1] : ((data[i + 1] - gLo) / (gHi - gLo)) * 255);
    data[i + 2] = clamp(bHi === bLo ? data[i + 2] : ((data[i + 2] - bLo) / (bHi - bLo)) * 255);
  }
}

function applyContrast(data: Uint8ClampedArray, c: number): void {
  const f = (259 * (c + 255)) / (255 * (259 - c));
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = clamp(f * (data[i]     - 128) + 128);
    data[i + 1] = clamp(f * (data[i + 1] - 128) + 128);
    data[i + 2] = clamp(f * (data[i + 2] - 128) + 128);
  }
}

function applySharpen(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const s = src.data, d = dst.data;
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            sum += s[((y + dy) * w + (x + dx)) * 4 + c] * k[(dy + 1) * 3 + (dx + 1)];
        d[(y * w + x) * 4 + c] = clamp(sum);
      }
      d[(y * w + x) * 4 + 3] = 255;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 4; c++) {
      d[x * 4 + c] = s[x * 4 + c];
      d[((h - 1) * w + x) * 4 + c] = s[((h - 1) * w + x) * 4 + c];
    }
  }
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 4; c++) {
      d[y * w * 4 + c] = s[y * w * 4 + c];
      d[(y * w + w - 1) * 4 + c] = s[(y * w + w - 1) * 4 + c];
    }
  }
  ctx.putImageData(dst, 0, 0);
}

// ── Detección IA de esquinas ──────────────────────────────────

async function detectCornersAI(
  canvas: HTMLCanvasElement
): Promise<Corners | null> {
  try {
    // Reducir a máx 700px para que el payload sea liviano (~80KB)
    const maxDim = 700;
    let sw = canvas.width, sh = canvas.height;
    const s = maxDim / Math.max(sw, sh);
    if (s < 1) { sw = Math.round(sw * s); sh = Math.round(sh * s); }

    const small = document.createElement("canvas");
    small.width = sw; small.height = sh;
    small.getContext("2d")!.drawImage(canvas, 0, 0, sw, sh);
    const base64 = small.toDataURL("image/jpeg", 0.85).split(",")[1];

    const { data, error } = await supabase.functions.invoke("scan-document", {
      body: { imageBase64: base64, width: sw, height: sh },
    });

    if (error) { console.error("AI error:", error); return null; }
    if (!data?.found) { console.warn("AI: document not found"); return null; }

    const { tl, tr, bl, br } = data;
    if (!tl || !tr || !bl || !br) return null;

    // Escalar esquinas de vuelta al tamaño original del canvas
    const scaleX = canvas.width / sw;
    const scaleY = canvas.height / sh;
    return {
      tl: { x: tl.x * scaleX, y: tl.y * scaleY },
      tr: { x: tr.x * scaleX, y: tr.y * scaleY },
      br: { x: br.x * scaleX, y: br.y * scaleY },
      bl: { x: bl.x * scaleX, y: bl.y * scaleY },
    };
  } catch (err) {
    console.error("detectCornersAI exception:", err);
    return null;
  }
}

// ── Transformación de perspectiva homográfica ─────────────────

function gaussianElim(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let max = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[max][col])) max = row;
    }
    [M[col], M[max]] = [M[max], M[col]];
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[col][col]) < 1e-12) continue;
      const f = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) M[row][k] -= f * M[col][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    if (Math.abs(M[i][i]) > 1e-12) x[i] /= M[i][i];
  }
  return x;
}

function computeH(src: Point[], dst: Point[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: x1, y: y1 } = src[i];
    const { x: x2, y: y2 } = dst[i];
    A.push([x1, y1, 1, 0, 0, 0, -x2 * x1, -x2 * y1]);
    b.push(x2);
    A.push([0, 0, 0, x1, y1, 1, -y2 * x1, -y2 * y1]);
    b.push(y2);
  }
  return [...gaussianElim(A, b), 1];
}

function applyH(H: number[], x: number, y: number): Point {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function warpPerspective(src: HTMLCanvasElement, corners: Corners): HTMLCanvasElement {
  // Tamaño de salida basado en distancias reales entre esquinas
  const dstW = Math.round((dist(corners.tl, corners.tr) + dist(corners.bl, corners.br)) / 2);
  const dstH = Math.round((dist(corners.tl, corners.bl) + dist(corners.tr, corners.br)) / 2);

  // Limitar a 1600px en el lado mayor
  const scale = Math.min(1, 1600 / Math.max(dstW, dstH));
  const outW = Math.round(dstW * scale);
  const outH = Math.round(dstH * scale);

  // H mapea destino → origen (inverse mapping)
  const dstPts = [
    { x: 0, y: 0 }, { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 }, { x: 0, y: outH - 1 },
  ];
  const srcPts = [corners.tl, corners.tr, corners.br, corners.bl].map((p) => ({
    x: p.x * scale, y: p.y * scale, // ya no necesitamos, usamos coords orig
  }));
  // Usamos coords originales del src canvas
  const srcPtsOrig = [corners.tl, corners.tr, corners.br, corners.bl];
  const H = computeH(dstPts, srcPtsOrig);

  const dst = document.createElement("canvas");
  dst.width = outW; dst.height = outH;
  const dstCtx = dst.getContext("2d")!;

  const srcCtx = src.getContext("2d")!;
  const srcData = srcCtx.getImageData(0, 0, src.width, src.height);
  const dstData = dstCtx.createImageData(outW, outH);
  const sw = src.width;

  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      const { x: sx, y: sy } = applyH(H, dx, dy);
      const sx0 = Math.floor(sx), sy0 = Math.floor(sy);
      const sx1 = sx0 + 1, sy1 = sy0 + 1;
      if (sx0 < 0 || sy0 < 0 || sx1 >= src.width || sy1 >= src.height) continue;
      const fx = sx - sx0, fy = sy - sy0;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy,       w11 = fx * fy;
      const di = (dy * outW + dx) * 4;
      for (let c = 0; c < 3; c++) {
        dstData.data[di + c] = clamp(
          w00 * srcData.data[(sy0 * sw + sx0) * 4 + c] +
          w10 * srcData.data[(sy0 * sw + sx1) * 4 + c] +
          w01 * srcData.data[(sy1 * sw + sx0) * 4 + c] +
          w11 * srcData.data[(sy1 * sw + sx1) * 4 + c]
        );
      }
      dstData.data[di + 3] = 255;
    }
  }
  // Limpiar srcPts sin uso
  void srcPts;
  dstCtx.putImageData(dstData, 0, 0);
  return dst;
}

// ── Fallback: crop simple por luminosidad ─────────────────────

function simpleCrop(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const w = canvas.width, h = canvas.height;
  let top = h, bottom = 0, left = w, right = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum > 155) {
        if (y < top)    top    = y;
        if (y > bottom) bottom = y;
        if (x < left)   left   = x;
        if (x > right)  right  = x;
      }
    }
  }
  const pad = 15;
  const bx = Math.max(0, left - pad), by = Math.max(0, top - pad);
  const bw = Math.min(w - bx, right - left + pad * 2);
  const bh = Math.min(h - by, bottom - top + pad * 2);
  if (bw < w * 0.2 || bh < h * 0.2) return canvas;
  const out = document.createElement("canvas");
  out.width = bw; out.height = bh;
  out.getContext("2d")!.drawImage(canvas, bx, by, bw, bh, 0, 0, bw, bh);
  return out;
}

// ── Pipeline principal ────────────────────────────────────────

async function processDocumentImage(
  file: File,
  onStatus: (s: string) => void
): Promise<{ blob: Blob; preview: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objUrl);
      try {
        // 1. Escalar a máx 1800px
        const maxDim = 1800;
        let iw = img.naturalWidth, ih = img.naturalHeight;
        if (iw > maxDim || ih > maxDim) {
          const s = maxDim / Math.max(iw, ih);
          iw = Math.round(iw * s); ih = Math.round(ih * s);
        }
        const canvas = document.createElement("canvas");
        canvas.width = iw; canvas.height = ih;
        canvas.getContext("2d")!.drawImage(img, 0, 0, iw, ih);

        // 2. Detección IA de esquinas
        onStatus("Analizando documento con IA…");
        const corners = await detectCornersAI(canvas);

        let workCanvas: HTMLCanvasElement;
        if (corners) {
          // 3a. Transformación de perspectiva
          onStatus("Corrigiendo perspectiva…");
          workCanvas = warpPerspective(canvas, corners);
        } else {
          // 3b. Fallback: crop por luminosidad
          onStatus("Recortando documento…");
          workCanvas = simpleCrop(canvas);
        }

        // 4. Mejoras de imagen
        onStatus("Mejorando imagen…");
        const ctx = workCanvas.getContext("2d")!;
        const imgData = ctx.getImageData(0, 0, workCanvas.width, workCanvas.height);
        autoLevels(imgData.data);
        applyContrast(imgData.data, 18);
        ctx.putImageData(imgData, 0, 0);
        applySharpen(ctx, workCanvas.width, workCanvas.height);

        workCanvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("Error al procesar")); return; }
            resolve({ blob, preview: workCanvas.toDataURL("image/jpeg", 0.93) });
          },
          "image/jpeg", 0.93
        );
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error("No se pudo cargar")); };
    img.src = objUrl;
  });
}

// ── Componente ────────────────────────────────────────────────

export function DniCapture({ tipo, currentUrl, onConfirm, disabled }: Props) {
  const [stage, setStage] = useState<"idle" | "preview" | "processing" | "done">(
    currentUrl ? "done" : "idle"
  );
  const [statusMsg, setStatusMsg] = useState("Detectando documento…");
  const [originalPreview, setOriginalPreview] = useState("");
  const [processedPreview, setProcessedPreview] = useState("");
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  const label = tipo === "frente" ? "DNI Frente" : "DNI Dorso";

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Usá JPG o PNG."); return; }
    if (file.size > 30 * 1024 * 1024) { setError("El archivo es demasiado grande (máx. 30 MB)."); return; }
    setError("");
    const original = URL.createObjectURL(file);
    setOriginalPreview(original);
    setStatusMsg("Analizando documento con IA…");
    setStage("processing");
    try {
      const { blob, preview } = await processDocumentImage(file, setStatusMsg);
      setProcessedBlob(blob);
      setProcessedPreview(preview);
      setStage("preview");
    } catch {
      setError("No se pudo procesar la imagen. Intentá de nuevo.");
      setStage("idle");
      URL.revokeObjectURL(original);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleConfirm = () => {
    if (!processedBlob || !processedPreview) return;
    onConfirm(processedBlob, processedPreview);
    setStage("done");
  };

  const handleRetake = () => {
    setStage("idle");
    setOriginalPreview("");
    setProcessedPreview("");
    setProcessedBlob(null);
    setError("");
  };

  const displayUrl = stage === "done" ? (currentUrl || processedPreview) : "";

  return (
    <div className="border border-[#e8e8e4] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e8e8e4] flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#0a0a0a]">{label}</span>
        {stage === "done" && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700">
            <Check size={13} /> Cargado
          </span>
        )}
      </div>

      <div className="p-4">
        {stage === "idle" && (
          <div>
            <p className="text-[12px] text-[#6b6b6b] mb-4">
              Colocá el DNI sobre la mesa y tomá la foto. La IA detectará y recortará el documento automáticamente.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button type="button" disabled={disabled}
                onClick={() => cameraRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 h-11 border border-[#0a0a0a] text-[12px] font-semibold text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-colors disabled:opacity-40">
                <Camera size={16} /> Tomar foto
              </button>
              <button type="button" disabled={disabled}
                onClick={() => fileRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 h-11 border border-[#e8e8e4] text-[12px] font-semibold text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors disabled:opacity-40">
                <Upload size={16} /> Subir archivo
              </button>
            </div>
            {error && <p className="mt-3 text-[12px] text-red-600 font-medium">{error}</p>}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInputChange} />
            <input ref={fileRef}   type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
          </div>
        )}

        {stage === "processing" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 size={28} className="animate-spin text-[#0a0a0a]" />
            <div className="text-center">
              <p className="text-[13px] font-semibold text-[#0a0a0a]">{statusMsg}</p>
              <p className="text-[11px] text-[#6b6b6b] mt-1">Esto puede demorar unos segundos</p>
            </div>
            {originalPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={originalPreview} alt="Original" className="w-full max-w-xs object-contain opacity-40" />
            )}
          </div>
        )}

        {stage === "preview" && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#a3a3a3] mb-1.5">Original</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={originalPreview} alt="Original"
                  className="w-full object-contain border border-[#e8e8e4] bg-[#f7f7f6]" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#a3a3a3] mb-1.5">Procesado</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={processedPreview} alt="Procesado"
                  className="w-full object-contain border-2 border-[#0a0a0a] bg-[#f7f7f6]" />
              </div>
            </div>
            <p className="text-[11px] text-[#6b6b6b] mb-4">
              Revisá que el documento se vea completo y legible.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={handleRetake}
                className="flex items-center gap-2 h-10 px-4 border border-[#e8e8e4] text-[11px] font-semibold text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors">
                <RotateCcw size={13} /> Repetir foto
              </button>
              <button type="button" onClick={handleConfirm}
                className="flex items-center gap-2 h-10 px-5 bg-[#0a0a0a] text-white text-[11px] font-bold tracking-[0.05em] hover:bg-[#1a1a1a] transition-colors">
                <Check size={13} /> Confirmar
              </button>
            </div>
          </div>
        )}

        {stage === "done" && displayUrl && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayUrl} alt={label}
              className="w-full max-h-48 object-contain border border-[#e8e8e4] bg-[#f7f7f6] mb-3" />
            <button type="button" onClick={handleRetake}
              className="flex items-center gap-2 h-9 px-4 border border-[#e8e8e4] text-[11px] font-semibold text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors">
              <RotateCcw size={13} /> Cambiar foto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
