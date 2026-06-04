"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Upload, RotateCcw, Check, Loader2 } from "lucide-react";
import { detectDocumentCorners, preloadOpenCV } from "@/lib/opencvLoader";
import type { Corners, Point } from "@/lib/opencvLoader";

// ── Guide frame constants ──────────────────────────────────────
// ID card: 85.6 × 53.98 mm (ISO 7810 CR80)
const GUIDE_W_RATIO    = 0.82;
const GUIDE_ASPECT     = 85.6 / 53.98;          // ≈ 1.586
const CONTAINER_ASPECT = 4 / 3;
const GUIDE_H_RATIO    = (GUIDE_W_RATIO / GUIDE_ASPECT) * CONTAINER_ASPECT; // ≈ 0.689
const GUIDE_X_RATIO    = (1 - GUIDE_W_RATIO) / 2;  // ≈ 0.09
const GUIDE_Y_RATIO    = (1 - GUIDE_H_RATIO) / 2;  // ≈ 0.155

// ── Image enhancement utilities ───────────────────────────────

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

// ── Perspective warp (homographic inverse mapping) ────────────

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

function ptDist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function warpPerspective(srcCanvas: HTMLCanvasElement, corners: Corners): HTMLCanvasElement {
  const dstW = Math.round((ptDist(corners.tl, corners.tr) + ptDist(corners.bl, corners.br)) / 2);
  const dstH = Math.round((ptDist(corners.tl, corners.bl) + ptDist(corners.tr, corners.br)) / 2);
  const scale = Math.min(1, 1600 / Math.max(dstW, dstH));
  const outW = Math.round(dstW * scale);
  const outH = Math.round(dstH * scale);

  const dstPts: Point[] = [
    { x: 0, y: 0 }, { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 }, { x: 0, y: outH - 1 },
  ];
  const H = computeH(dstPts, [corners.tl, corners.tr, corners.br, corners.bl]);

  const dst    = document.createElement("canvas");
  dst.width    = outW;
  dst.height   = outH;
  const dstCtx = dst.getContext("2d")!;
  const srcCtx = srcCanvas.getContext("2d")!;
  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const dstData = dstCtx.createImageData(outW, outH);
  const sw = srcCanvas.width;

  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      const { x: sx, y: sy } = applyH(H, dx, dy);
      const sx0 = Math.floor(sx), sy0 = Math.floor(sy);
      const sx1 = sx0 + 1, sy1 = sy0 + 1;
      if (sx0 < 0 || sy0 < 0 || sx1 >= srcCanvas.width || sy1 >= srcCanvas.height) continue;
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
  dstCtx.putImageData(dstData, 0, 0);
  return dst;
}

// ── Luminosity-based fallback crop ────────────────────────────

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

// ── Image loading & finalization helpers ──────────────────────

function loadImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1800;
      let w = img.naturalWidth, h = img.naturalHeight;
      const s = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * s); h = Math.round(h * s);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo cargar")); };
    img.src = url;
  });
}

// alreadyCropped = true skips warp/simpleCrop (camera guide already framed the doc)
function finalizeCanvas(canvas: HTMLCanvasElement, corners: Corners | null, alreadyCropped = false): HTMLCanvasElement {
  const work = alreadyCropped ? canvas : (corners ? warpPerspective(canvas, corners) : simpleCrop(canvas));
  const ctx  = work.getContext("2d")!;
  const imgData = ctx.getImageData(0, 0, work.width, work.height);
  autoLevels(imgData.data);
  applyContrast(imgData.data, 18);
  ctx.putImageData(imgData, 0, 0);
  applySharpen(ctx, work.width, work.height);
  return work;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas to blob failed"))),
      "image/jpeg", 0.93
    );
  });
}

// ── In-app camera with document guide overlay ──────────────────

interface CaptureResult {
  canvas: HTMLCanvasElement;
  /** Guide frame in video pixel coordinates (for fallback crop when OpenCV fails) */
  guidePx: { x: number; y: number; w: number; h: number };
}

interface CameraViewProps {
  onCapture: (result: CaptureResult) => void;
  onCancel: () => void;
}

function CameraView({ onCapture, onCancel }: CameraViewProps) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const [ready, setReady]       = useState(false);
  const [camError, setCamError] = useState("");

  useEffect(() => {
    let active = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("La cámara no está disponible en este dispositivo o navegador.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.onloadedmetadata = () =>
            v.play()
              .then(() => { if (active) setReady(true); })
              .catch(() => {});
        }
      })
      .catch(() => {
        if (active) setCamError("No se pudo acceder a la cámara. Usá 'Subir archivo' para continuar.");
      });
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = useCallback(() => {
    const video     = videoRef.current;
    const container = containerRef.current;
    if (!video || !container || !ready) return;

    const vW = video.videoWidth;
    const vH = video.videoHeight;
    const dW = container.clientWidth;
    const dH = container.clientHeight;

    // Guide frame in display pixels (centered)
    const gDW = dW * GUIDE_W_RATIO;
    const gDH = gDW / GUIDE_ASPECT;
    const gDX = (dW - gDW) / 2;
    const gDY = (dH - gDH) / 2;

    // Map display → video pixel coordinates (object-fit: cover)
    let scale: number, hOff: number, vOff: number;
    if (vW / vH > dW / dH) {
      scale = vH / dH;
      hOff  = (vW - dW * scale) / 2;
      vOff  = 0;
    } else {
      scale = vW / dW;
      hOff  = 0;
      vOff  = (vH - dH * scale) / 2;
    }

    const guidePx = {
      x: gDX * scale + hOff,
      y: gDY * scale + vOff,
      w: gDW * scale,
      h: gDH * scale,
    };

    // Capture full video frame (OpenCV will scan it for edge detection)
    const canvas = document.createElement("canvas");
    canvas.width  = vW;
    canvas.height = vH;
    canvas.getContext("2d")!.drawImage(video, 0, 0, vW, vH);

    onCapture({ canvas, guidePx });
  }, [ready, onCapture]);

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden bg-black"
        style={{ aspectRatio: String(CONTAINER_ASPECT) }}
      >
        {/* Live video */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Document guide overlay */}
        {ready && (
          <div className="absolute inset-0 pointer-events-none select-none">
            {/* Dark strips outside guide frame */}
            <div
              className="absolute top-0 left-0 right-0 bg-black/55"
              style={{ height: `${GUIDE_Y_RATIO * 100}%` }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 bg-black/55"
              style={{ height: `${GUIDE_Y_RATIO * 100}%` }}
            />
            <div
              className="absolute bg-black/55"
              style={{
                top:    `${GUIDE_Y_RATIO * 100}%`,
                bottom: `${GUIDE_Y_RATIO * 100}%`,
                left:   0,
                width:  `${GUIDE_X_RATIO * 100}%`,
              }}
            />
            <div
              className="absolute bg-black/55"
              style={{
                top:    `${GUIDE_Y_RATIO * 100}%`,
                bottom: `${GUIDE_Y_RATIO * 100}%`,
                right:  0,
                width:  `${GUIDE_X_RATIO * 100}%`,
              }}
            />

            {/* Guide frame */}
            <div
              className="absolute"
              style={{
                left:   `${GUIDE_X_RATIO * 100}%`,
                top:    `${GUIDE_Y_RATIO * 100}%`,
                width:  `${GUIDE_W_RATIO * 100}%`,
                height: `${GUIDE_H_RATIO * 100}%`,
              }}
            >
              {/* Thin border */}
              <div className="absolute inset-0 border border-white/40" />
              {/* Corner brackets — top-left */}
              <div className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-white" />
              {/* top-right */}
              <div className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-white" />
              {/* bottom-left */}
              <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-white" />
              {/* bottom-right */}
              <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-white" />
            </div>

            {/* Instruction text */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <span className="bg-black/65 text-white text-[11px] font-medium px-3 py-1.5 rounded-full tracking-wide">
                Centra el DNI dentro del recuadro
              </span>
            </div>
          </div>
        )}

        {!ready && !camError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-white" />
          </div>
        )}

        {camError && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <p className="text-white text-center text-[12px] leading-relaxed">{camError}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 h-11 px-4 border border-[#e8e8e4] text-[12px] font-semibold text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
        >
          Cancelar
        </button>
        {!camError ? (
          <button
            type="button"
            onClick={capture}
            disabled={!ready}
            className="flex-1 flex items-center justify-center gap-2 h-11 bg-[#0a0a0a] text-white text-[12px] font-bold hover:bg-[#1a1a1a] transition-colors disabled:opacity-40"
          >
            <Camera size={16} /> Tomar foto
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 h-11 bg-[#0a0a0a] text-white text-[12px] font-bold hover:bg-[#1a1a1a] transition-colors"
          >
            Volver
          </button>
        )}
      </div>
    </div>
  );
}

// ── Manual corner editor ───────────────────────────────────────

type CornerKey = keyof Corners;
type DisplayCorners = Record<CornerKey, Point>;

interface ManualEditorProps {
  imageUrl: string;
  naturalW: number;
  naturalH: number;
  onApply: (corners: Corners) => void;
  onSkip: () => void;
  onRetry: () => void;
}

function ManualCornersEditor({ imageUrl, naturalW, naturalH, onApply, onSkip, onRetry }: ManualEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);
  const dragging     = useRef<CornerKey | null>(null);

  const [dispSize, setDispSize] = useState({ w: 0, h: 0 });
  const [corners, setCorners]   = useState<DisplayCorners>({
    tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 },
    br: { x: 0, y: 0 }, bl: { x: 0, y: 0 },
  });

  const initCorners = useCallback((w: number, h: number) => {
    const p = 0.08;
    setCorners({
      tl: { x: w * p,       y: h * p       },
      tr: { x: w * (1 - p), y: h * p       },
      br: { x: w * (1 - p), y: h * (1 - p) },
      bl: { x: w * p,       y: h * (1 - p) },
    });
  }, []);

  const handleImgLoad = useCallback(() => {
    if (!imgRef.current) return;
    const w = imgRef.current.offsetWidth;
    const h = imgRef.current.offsetHeight;
    if (w > 0 && h > 0) {
      setDispSize({ w, h });
      initCorners(w, h);
    }
  }, [initCorners]);

  const handlePointerDown = useCallback(
    (key: CornerKey) => (e: React.PointerEvent<SVGCircleElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragging.current = key;
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      if (!dragging.current || !containerRef.current) return;
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(dispSize.w, e.clientX - rect.left));
      const y = Math.max(0, Math.min(dispSize.h, e.clientY - rect.top));
      const key = dragging.current;
      setCorners((prev) => ({ ...prev, [key]: { x, y } }));
    },
    [dispSize]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragging.current = null;
  }, []);

  const handleApply = useCallback(() => {
    if (dispSize.w === 0) return;
    const sx = naturalW / dispSize.w;
    const sy = naturalH / dispSize.h;
    onApply({
      tl: { x: corners.tl.x * sx, y: corners.tl.y * sy },
      tr: { x: corners.tr.x * sx, y: corners.tr.y * sy },
      br: { x: corners.br.x * sx, y: corners.br.y * sy },
      bl: { x: corners.bl.x * sx, y: corners.bl.y * sy },
    });
  }, [corners, dispSize, naturalW, naturalH, onApply]);

  const handles: CornerKey[] = ["tl", "tr", "br", "bl"];

  return (
    <div className="space-y-3">
      <div className="p-3 bg-amber-50 border border-amber-200">
        <p className="text-[11px] font-semibold text-amber-800">
          No detectamos el documento automáticamente
        </p>
        <p className="text-[11px] text-amber-700 mt-0.5">
          Arrastrá los cuatro puntos blancos hasta las esquinas del documento.
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden bg-[#f0f0ee] select-none"
        style={{ touchAction: "none" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Original"
          className="w-full h-auto block"
          onLoad={handleImgLoad}
          draggable={false}
        />

        {dispSize.w > 0 && (
          <svg
            className="absolute inset-0 w-full h-full overflow-visible"
            viewBox={`0 0 ${dispSize.w} ${dispSize.h}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <polygon
              points={`${corners.tl.x},${corners.tl.y} ${corners.tr.x},${corners.tr.y} ${corners.br.x},${corners.br.y} ${corners.bl.x},${corners.bl.y}`}
              fill="rgba(59,130,246,0.08)"
              stroke="#3b82f6"
              strokeWidth="1.5"
              strokeDasharray="6 3"
            />

            {handles.map((key) => {
              const pos = corners[key];
              return (
                <g key={key}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={22}
                    fill="transparent"
                    style={{ cursor: "grab", touchAction: "none" }}
                    onPointerDown={handlePointerDown(key)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={10}
                    fill="white"
                    stroke="#0a0a0a"
                    strokeWidth="2.5"
                    style={{ pointerEvents: "none" }}
                  />
                  <line
                    x1={pos.x - 4} y1={pos.y}
                    x2={pos.x + 4} y2={pos.y}
                    stroke="#0a0a0a" strokeWidth="1.5"
                    style={{ pointerEvents: "none" }}
                  />
                  <line
                    x1={pos.x} y1={pos.y - 4}
                    x2={pos.x} y2={pos.y + 4}
                    stroke="#0a0a0a" strokeWidth="1.5"
                    style={{ pointerEvents: "none" }}
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 h-9 px-3 border border-[#e8e8e4] text-[11px] font-semibold text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
        >
          <RotateCcw size={12} /> Reintentar
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="flex items-center gap-1.5 h-9 px-3 border border-[#e8e8e4] text-[11px] font-semibold text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
        >
          Usar sin corregir
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex items-center gap-1.5 h-9 px-4 bg-[#0a0a0a] text-white text-[11px] font-bold hover:bg-[#1a1a1a] transition-colors ml-auto"
        >
          <Check size={12} /> Aplicar corrección
        </button>
      </div>
    </div>
  );
}

// ── Component types ────────────────────────────────────────────

interface Props {
  tipo: "frente" | "dorso";
  currentUrl: string;
  onConfirm: (processedBlob: Blob, previewUrl: string) => void;
  disabled?: boolean;
}

type Stage = "idle" | "camera" | "preparing" | "processing" | "manual" | "preview" | "done";

// ── Main component ─────────────────────────────────────────────

export function DniCapture({ tipo, currentUrl, onConfirm, disabled }: Props) {
  const [stage, setStage]               = useState<Stage>(currentUrl ? "done" : "idle");
  const [statusMsg, setStatusMsg]       = useState("");
  const [originalPreview, setOrigPrev]  = useState("");
  const [processedPreview, setProcPrev] = useState("");
  const [processedBlob, setProcBlob]    = useState<Blob | null>(null);
  const [error, setError]               = useState("");

  const origCanvas = useRef<HTMLCanvasElement | null>(null);
  const fileRef    = useRef<HTMLInputElement>(null);

  const label = tipo === "frente" ? "DNI Frente" : "DNI Dorso";

  useEffect(() => {
    preloadOpenCV().catch(() => {});
  }, []);

  const applyAndPreview = useCallback(async (
    canvas: HTMLCanvasElement,
    corners: Corners | null,
    alreadyCropped = false
  ) => {
    setStage("processing");
    if (corners) {
      setStatusMsg("Corrigiendo perspectiva…");
    } else if (alreadyCropped) {
      setStatusMsg("Mejorando imagen…");
    } else {
      setStatusMsg("Recortando documento…");
    }

    await new Promise<void>((r) => setTimeout(r, 60));

    try {
      const processed = finalizeCanvas(canvas, corners, alreadyCropped);
      const blob      = await canvasToBlob(processed);
      setProcBlob(blob);
      setProcPrev(processed.toDataURL("image/jpeg", 0.93));
      setStage("preview");
    } catch {
      setError("Error al procesar la imagen. Intentá de nuevo.");
      setStage("idle");
    }
  }, []);

  // File upload path — unchanged (OpenCV + manual fallback)
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Usá un archivo JPG o PNG.");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError("El archivo es demasiado grande (máx. 30 MB).");
      return;
    }

    setError("");
    setOrigPrev(URL.createObjectURL(file));
    setStage("preparing");
    setStatusMsg("Cargando imagen…");

    try {
      const canvas = await loadImageToCanvas(file);
      origCanvas.current = canvas;

      setStage("processing");
      setStatusMsg("Detectando bordes del documento…");

      let corners: Corners | null = null;
      try {
        corners = await detectDocumentCorners(canvas);
      } catch {
        // OpenCV unavailable — fall through
      }

      if (corners) {
        await applyAndPreview(canvas, corners);
      } else {
        setStage("manual");
      }
    } catch {
      setError("No se pudo procesar la imagen. Intentá de nuevo.");
      setStage("idle");
    }
  }, [applyAndPreview]);

  // Camera path — OpenCV on full frame; guide crop as fallback
  const handleCameraCapture = useCallback(async ({ canvas, guidePx }: CaptureResult) => {
    origCanvas.current = canvas;
    setOrigPrev(canvas.toDataURL("image/jpeg", 0.85));
    setStage("processing");
    setStatusMsg("Detectando bordes del documento…");

    await new Promise<void>((r) => setTimeout(r, 60));

    let corners: Corners | null = null;
    try {
      corners = await detectDocumentCorners(canvas);
    } catch {
      // OpenCV unavailable
    }

    if (corners) {
      await applyAndPreview(canvas, corners);
    } else {
      // Crop to guide frame as smart fallback
      const { x, y, w, h } = guidePx;
      const cropped = document.createElement("canvas");
      cropped.width  = Math.round(w);
      cropped.height = Math.round(h);
      cropped.getContext("2d")!.drawImage(
        canvas,
        Math.round(x), Math.round(y), Math.round(w), Math.round(h),
        0, 0, cropped.width, cropped.height
      );
      origCanvas.current = cropped;
      setOrigPrev(cropped.toDataURL("image/jpeg", 0.85));
      await applyAndPreview(cropped, null, true);
    }
  }, [applyAndPreview]);

  const handleManualApply = useCallback((corners: Corners) => {
    if (origCanvas.current) applyAndPreview(origCanvas.current, corners);
  }, [applyAndPreview]);

  const handleManualSkip = useCallback(() => {
    if (origCanvas.current) applyAndPreview(origCanvas.current, null);
  }, [applyAndPreview]);

  const handleConfirm = useCallback(() => {
    if (!processedBlob || !processedPreview) return;
    onConfirm(processedBlob, processedPreview);
    setStage("done");
  }, [processedBlob, processedPreview, onConfirm]);

  const handleRetake = useCallback(() => {
    setStage("idle");
    setOrigPrev("");
    setProcPrev("");
    setProcBlob(null);
    setError("");
    origCanvas.current = null;
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  const displayUrl = stage === "done" ? (currentUrl || processedPreview) : "";

  return (
    <div className="border border-[#e8e8e4] bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e8e8e4] flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#0a0a0a]">
          {label}
        </span>
        {stage === "done" && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700">
            <Check size={13} /> Cargado
          </span>
        )}
      </div>

      <div className="p-4">
        {/* ── idle ───────────────────────────────────────────── */}
        {stage === "idle" && (
          <div>
            <p className="text-[12px] text-[#6b6b6b] mb-4">
              Colocá el DNI sobre una superficie plana y centralo dentro del
              recuadro. El sistema corregirá la perspectiva automáticamente.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setStage("camera")}
                className="flex-1 flex items-center justify-center gap-2 h-11 border border-[#0a0a0a] text-[12px] font-semibold text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white transition-colors disabled:opacity-40"
              >
                <Camera size={16} /> Tomar foto
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => fileRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 h-11 border border-[#e8e8e4] text-[12px] font-semibold text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors disabled:opacity-40"
              >
                <Upload size={16} /> Subir archivo
              </button>
            </div>
            {error && (
              <p className="mt-3 text-[12px] text-red-600 font-medium">{error}</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>
        )}

        {/* ── in-app camera ──────────────────────────────────── */}
        {stage === "camera" && (
          <CameraView
            onCapture={handleCameraCapture}
            onCancel={handleRetake}
          />
        )}

        {/* ── preparing / processing ─────────────────────────── */}
        {(stage === "preparing" || stage === "processing") && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 size={28} className="animate-spin text-[#0a0a0a]" />
            <div className="text-center">
              <p className="text-[13px] font-semibold text-[#0a0a0a]">{statusMsg}</p>
              <p className="text-[11px] text-[#6b6b6b] mt-1">
                Procesamiento local — no se envían imágenes a ningún servidor
              </p>
            </div>
            {originalPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={originalPreview}
                alt="Original"
                className="w-full max-w-xs object-contain opacity-40"
              />
            )}
          </div>
        )}

        {/* ── manual corner editor (file upload fallback) ────── */}
        {stage === "manual" && originalPreview && origCanvas.current && (
          <ManualCornersEditor
            imageUrl={originalPreview}
            naturalW={origCanvas.current.width}
            naturalH={origCanvas.current.height}
            onApply={handleManualApply}
            onSkip={handleManualSkip}
            onRetry={handleRetake}
          />
        )}

        {/* ── split preview ──────────────────────────────────── */}
        {stage === "preview" && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#a3a3a3] mb-1.5">
                  Original
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalPreview}
                  alt="Original"
                  className="w-full object-contain border border-[#e8e8e4] bg-[#f7f7f6]"
                />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#a3a3a3] mb-1.5">
                  Procesado
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={processedPreview}
                  alt="Procesado"
                  className="w-full object-contain border-2 border-[#0a0a0a] bg-[#f7f7f6]"
                />
              </div>
            </div>
            <p className="text-[11px] text-[#6b6b6b] mb-4">
              Revisá que el documento se vea completo y legible.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="flex items-center gap-2 h-10 px-4 border border-[#e8e8e4] text-[11px] font-semibold text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
              >
                <RotateCcw size={13} /> Repetir foto
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex items-center gap-2 h-10 px-5 bg-[#0a0a0a] text-white text-[11px] font-bold tracking-[0.05em] hover:bg-[#1a1a1a] transition-colors"
              >
                <Check size={13} /> Confirmar documento
              </button>
            </div>
          </div>
        )}

        {/* ── done ───────────────────────────────────────────── */}
        {stage === "done" && displayUrl && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayUrl}
              alt={label}
              className="w-full max-h-48 object-contain border border-[#e8e8e4] bg-[#f7f7f6] mb-3"
            />
            <button
              type="button"
              onClick={handleRetake}
              className="flex items-center gap-2 h-9 px-4 border border-[#e8e8e4] text-[11px] font-semibold text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
            >
              <RotateCcw size={13} /> Cambiar foto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
