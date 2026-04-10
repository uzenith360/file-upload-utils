// Added this cos of the ts-node build errors complaining about lib: dom 
/// <reference lib="dom" />

import FileData from "./file-data.type";

type GetPreviewFileDataOptions = {
  /**
   * Exact target width. Height is computed automatically if height is not provided.
   */
  width?: number;

  /**
   * Exact target height. Width is computed automatically if width is not provided.
   */
  height?: number;

  /**
   * Optional bounding box fallback if width/height are not explicitly provided.
   */
  maxWidth?: number;
  maxHeight?: number;

  /**
   * Output quality/compression.
   */
  quality?: number;

  /**
   * Output mime type.
   */
  type?: 'image/webp' | 'image/jpeg';

  /**
   * Whether to allow enlarging small source images.
   * Defaults to false.
   */
  allowUpscale?: boolean;
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

const toPositiveInteger = (value: unknown): number | undefined => {
  if (!Number.isFinite(value) || Number(value) <= 0) {
    return undefined;
  }

  return Math.floor(Number(value));
};

const calculateTargetSize = (
  sourceWidth: number,
  sourceHeight: number,
  options?: GetPreviewFileDataOptions,
): { width: number; height: number } => {
  const requestedWidth = toPositiveInteger(options?.width);
  const requestedHeight = toPositiveInteger(options?.height);
  const maxWidth = toPositiveInteger(options?.maxWidth) ?? 320;
  const maxHeight = toPositiveInteger(options?.maxHeight) ?? 320;
  const allowUpscale = options?.allowUpscale === true;

  const aspectRatio = sourceWidth / sourceHeight;

  let targetWidth: number;
  let targetHeight: number;

  if (requestedWidth && requestedHeight) {
    /**
     * Fit inside the requested box while preserving aspect ratio.
     */
    const widthScale = requestedWidth / sourceWidth;
    const heightScale = requestedHeight / sourceHeight;
    let scale = Math.min(widthScale, heightScale);

    if (!allowUpscale) {
      scale = Math.min(scale, 1);
    }

    targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  } else if (requestedWidth) {
    targetWidth = allowUpscale
      ? requestedWidth
      : Math.min(requestedWidth, sourceWidth);

    targetHeight = Math.max(1, Math.round(targetWidth / aspectRatio));
  } else if (requestedHeight) {
    targetHeight = allowUpscale
      ? requestedHeight
      : Math.min(requestedHeight, sourceHeight);

    targetWidth = Math.max(1, Math.round(targetHeight * aspectRatio));
  } else {
    const widthScale = maxWidth / sourceWidth;
    const heightScale = maxHeight / sourceHeight;
    let scale = Math.min(widthScale, heightScale);

    if (!allowUpscale) {
      scale = Math.min(scale, 1);
    }

    targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  }

  return {
    width: targetWidth,
    height: targetHeight,
  };
};

export default async (
  file: File,
  options?: GetPreviewFileDataOptions,
): Promise<FileData> => {
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

    const targetSize = calculateTargetSize(sourceWidth, sourceHeight, options);

    const canvas = document.createElement('canvas');
    canvas.width = targetSize.width;
    canvas.height = targetSize.height;

    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });

    if (!ctx) {
      throw new Error('Could not create canvas context');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(drawSource, 0, 0, targetSize.width, targetSize.height);

    const blob = await canvasToBlob(canvas, type, quality);
    const src = URL.createObjectURL(blob);

    canvas.width = 0;
    canvas.height = 0;

    return {
      src,
      width: targetSize.width,
      height: targetSize.height,
    };
  } finally {
    if (drawSource && 'close' in drawSource && typeof drawSource.close === 'function') {
      drawSource.close();
    }
  }
};
