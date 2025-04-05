import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Jimp } from 'jimp';
import { decode, encode } from 'fast-png';
import createDebug from 'debug';

const debug = createDebug('image');

export type Size = {
  width?: number;
  height?: number;
};

export async function loadImage(url: string) {
  url = encodeURI(url);
  try {
    return await Jimp.read(url);
  } catch (error_: unknown) {
    const error = error_ as Error;
    if (error.message?.includes('unrecognised content at end of stream')) {
      debug(`Failed to load image from "${url}", trying to fix incorrect PNG...`);
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const png = decode(buffer);
      const fixedPng = encode(png);
      return Jimp.read(Buffer.from(fixedPng));
    }

    throw error;
  }
}

export async function resizeImageTo(url: string, destination: string, size?: Size) {
  try {
    const width = size?.width ?? 300;
    const height = size?.height;
    const image = await loadImage(url);
    const isLargerThanTaller = !height || image.bitmap.width >= image.bitmap.height;
    const imgWidth = isLargerThanTaller ? width : undefined;
    const imgHeight = isLargerThanTaller ? undefined : height;
    await mkdir(path.dirname(destination), { recursive: true });
    await image.resize({ w: imgWidth!, h: imgHeight }).write(destination as `${string}.${string}`);
  } catch (error: any) {
    console.error(`Failed to download art from "${url}": ${error.message}`);
  }
}

export async function composeImageTo(
  url1: string | undefined,
  url2: string | undefined,
  destination: string,
  size?: Size
) {
  try {
    const width = size?.width ?? 300;
    const margin = Math.round((width * 5) / 100);
    const height = size?.height ?? width;
    await mkdir(path.dirname(destination), { recursive: true });
    const image1 = url1 ? await loadImage(url1) : undefined;
    const image2 = url2 ? await loadImage(url2) : undefined;
    const image = new Jimp({ width, height, color: 0x00_00_00_00 });

    if (image2) {
      const img2Width = image2.bitmap.width >= image2.bitmap.height ? width - margin : undefined;
      const img2Height = image2.bitmap.width < image2.bitmap.height ? height - margin : undefined;
      image2.resize({ w: img2Width!, h: img2Height });
      image.composite(image2, 0, (height - image2.bitmap.height) / 2 - margin);
    }

    if (image1) {
      const img1Width = image1.bitmap.width >= image1.bitmap.height ? width / 2 - margin : undefined;
      const img1Height = image1.bitmap.width < image1.bitmap.height ? height / 2 - margin : undefined;
      image1.resize({ w: img1Width!, h: img1Height });
      image.composite(image1, width - image1.bitmap.width, height - image1.bitmap.height);
    }

    await image.write(destination as `${string}.${string}`);
  } catch (error: any) {
    console.error(`Failed to download art from "${url1}" or "${url2}": ${error.message}`);
  }
}
