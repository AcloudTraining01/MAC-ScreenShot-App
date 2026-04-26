/**
 * OCR Service — wraps Tesseract.js to extract text from screenshots.
 *
 * Tesseract.js v5 is already in dependencies. This service manages a
 * singleton worker so it doesn't reload the WASM model on every call.
 */
import Tesseract, { type Worker, type RecognizeResult } from 'tesseract.js';
import type { OcrResult } from '../../../shared/types';

let worker: Worker | null = null;
let workerReady = false;
let initPromise: Promise<void> | null = null;

/** Initialize (or return the cached) Tesseract worker */
async function getWorker(): Promise<Worker> {
  if (worker && workerReady) return worker;

  if (initPromise) {
    await initPromise;
    return worker!;
  }

  initPromise = (async () => {
    console.log('[OCR] Initializing Tesseract worker…');
    worker = await Tesseract.createWorker('eng', 1, {
      // Suppress verbose Tesseract console output
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    workerReady = true;
    console.log('[OCR] Worker ready.');
  })();

  await initPromise;
  return worker!;
}

/**
 * Extract text from a data URI or image URL.
 * Returns an OcrResult with the extracted text and per-word bounding boxes.
 */
export async function extractText(imageSource: string): Promise<OcrResult> {
  const w = await getWorker();

  const result: RecognizeResult = await w.recognize(imageSource);
  const { text, confidence, words } = result.data;

  return {
    text: text.trim(),
    confidence,
    words: words.map((word) => ({
      text: word.text,
      confidence: word.confidence,
      bbox: {
        x0: word.bbox.x0,
        y0: word.bbox.y0,
        x1: word.bbox.x1,
        y1: word.bbox.y1,
      },
    })),
  };
}

/**
 * Extract text from a rectangular region of an image.
 * @param imageSource  Full image data URI
 * @param rect         Region { left, top, width, height } in pixels
 */
export async function extractTextFromRegion(
  imageSource: string,
  rect: { left: number; top: number; width: number; height: number }
): Promise<OcrResult> {
  const w = await getWorker();

  const result: RecognizeResult = await w.recognize(imageSource, { rectangle: rect });
  const { text, confidence, words } = result.data;

  return {
    text: text.trim(),
    confidence,
    words: words.map((word) => ({
      text: word.text,
      confidence: word.confidence,
      bbox: {
        x0: word.bbox.x0,
        y0: word.bbox.y0,
        x1: word.bbox.x1,
        y1: word.bbox.y1,
      },
    })),
  };
}

/**
 * Terminate the worker and free memory. Call this on app unmount if needed.
 */
export async function terminateOcrWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    workerReady = false;
    initPromise = null;
    console.log('[OCR] Worker terminated.');
  }
}
