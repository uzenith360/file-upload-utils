// Added this cos of the ts-node build errors complaining about lib: dom 
/// <reference lib="dom" />

import FileData from "./file-data.type";

type GetPreviewFileDataOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  type?: 'image/webp' | 'image/jpeg';
};

const loadImageElement = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';

    const cleanup = (): void => {
      URL.revokeObjectURL(objectUrl);
    };

    image.onload = () => {
      resolve(image);
      cleanup();
    };

    image.onerror = (error) => {
      cleanup();
      reject(error);
    };

    image.src = objectUrl;
  });

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create preview blob'));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });

export default async (
  file: File,
  options?: GetPreviewFileDataOptions,
): Promise<FileData> => {
  const maxWidth = options?.maxWidth ?? 320;
  const maxHeight = options?.maxHeight ?? 320;
  const quality = options?.quality ?? 0.72;
  const type = options?.type ?? 'image/webp';

  let sourceWidth = 0;
  let sourceHeight = 0;
  let drawSource: ImageBitmap | HTMLImageElement | undefined;

  try {
    if ('createImageBitmap' in globalThis) {
      const bitmap = await createImageBitmap(file);
      drawSource = bitmap;
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
    } else {
      const image = await loadImageElement(file);
      drawSource = image;
      sourceWidth = image.naturalWidth || image.width;
      sourceHeight = image.naturalHeight || image.height;
    }

    const scale = Math.min(
      maxWidth / sourceWidth,
      maxHeight / sourceHeight,
      1,
    );

    const previewWidth = Math.max(1, Math.round(sourceWidth * scale));
    const previewHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = previewWidth;
    canvas.height = previewHeight;

    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });

    if (!ctx) {
      throw new Error('Could not create canvas context');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(drawSource, 0, 0, previewWidth, previewHeight);

    const blob = await canvasToBlob(canvas, type, quality);
    const src = URL.createObjectURL(blob);

    canvas.width = 0;
    canvas.height = 0;

    return {
      src,
      width: previewWidth,
      height: previewHeight,
    };
  } finally {
    if (drawSource && 'close' in drawSource && typeof drawSource.close === 'function') {
      drawSource.close();
    }
  }
};
