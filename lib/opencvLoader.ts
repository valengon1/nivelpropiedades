/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Lazy-loads OpenCV.js (WASM) and exposes document corner detection.
 *
 * To self-host instead of using the CDN:
 *   1. Download https://docs.opencv.org/4.x/opencv.js to /public/opencv.js
 *   2. Change OPENCV_URL to "/opencv.js"
 */

declare global {
  interface Window {
    cv: any;
    Module: { onRuntimeInitialized: () => void };
  }
}

export type Point = { x: number; y: number };
export type Corners = { tl: Point; tr: Point; br: Point; bl: Point };

const OPENCV_URL = "https://docs.opencv.org/4.x/opencv.js";

let _promise: Promise<void> | null = null;

export function preloadOpenCV(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (_promise) return _promise;

  _promise = new Promise<void>((resolve, reject) => {
    if (window.cv?.Mat) { resolve(); return; }

    // Must be set before the script loads — Emscripten calls this when WASM is ready
    window.Module = { onRuntimeInitialized: () => resolve() };

    const script = document.createElement("script");
    script.src = OPENCV_URL;
    script.async = true;
    // Fallback: if cv is already ready by the time onload fires (cached WASM)
    script.onload = () => { if (window.cv?.Mat) resolve(); };
    script.onerror = () => {
      _promise = null;
      reject(new Error("No se pudo cargar el procesador de imágenes"));
    };
    document.head.appendChild(script);
  });

  return _promise;
}

function orderCorners(pts: Point[]): Corners {
  const sorted = [...pts].sort((a, b) => a.y - b.y);
  const [tl, tr] = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const [bl, br] = sorted.slice(2).sort((a, b) => a.x - b.x);
  return { tl, tr, bl, br };
}

/**
 * Uses OpenCV.js (WebAssembly) to detect the 4 corners of a document.
 *
 * Pipeline: grayscale → GaussianBlur → Canny edges → dilate → findContours → approxPolyDP
 *
 * Returns ordered corners { tl, tr, br, bl } or null if no document was found.
 * All intermediate OpenCV Mats are freed in the finally block.
 */
export async function detectDocumentCorners(
  canvas: HTMLCanvasElement
): Promise<Corners | null> {
  await preloadOpenCV();
  const cv = window.cv;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const src       = cv.matFromImageData(imageData);
  const gray      = new cv.Mat();
  const blurred   = new cv.Mat();
  const edges     = new cv.Mat();
  const dilated   = new cv.Mat();
  const contours  = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    // 1. Grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 2. Gaussian blur — reduces noise before edge detection
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // 3. Canny edge detection
    cv.Canny(blurred, edges, 75, 200);

    // 4. Dilate to close small gaps between edges
    const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.dilate(edges, dilated, kernel);
    kernel.delete();

    // 5. Find external contours only
    cv.findContours(
      dilated, contours, hierarchy,
      cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE
    );

    const imageArea = canvas.width * canvas.height;
    let bestCorners: Corners | null = null;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      // Skip tiny contours (< 8% of image area) — table edges, noise, etc.
      if (area < imageArea * 0.08) {
        contour.delete();
        continue;
      }

      const peri   = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);

      // Accept only convex quadrilaterals — documents are rectangles/trapezoids
      if (approx.rows === 4 && cv.isContourConvex(approx) && area > bestArea) {
        bestArea = area;
        const pts: Point[] = [];
        for (let j = 0; j < 4; j++) {
          pts.push({
            x: approx.data32S[j * 2],
            y: approx.data32S[j * 2 + 1],
          });
        }
        bestCorners = orderCorners(pts);
      }

      approx.delete();
      contour.delete();
    }

    return bestCorners;

  } finally {
    // Always free WASM heap memory
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    dilated.delete();
    contours.delete();
    hierarchy.delete();
  }
}
