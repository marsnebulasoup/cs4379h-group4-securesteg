import { encode } from 'fast-png';
import { PixelChannels, StegPixel } from './StegPixel';

export const STEG_CHANNEL_COUNT = 4; // 4 channels per pixel (r,g,b,a)
export const STEG_COLOR_DEPTH = 8;   // each channel is 1 byte aka 8 bits

export class StegImage {
    file: File;
    isReady: boolean;
    channels: ImageDataArray;
    width: number;
    height: number;

    constructor(file: File) {
        this.file = file;
        this.isReady = false;
        this.channels = new Uint8ClampedArray()
        this.width = 0;
        this.height = 0;
    }

    async prepare() {
        try {
            const { imageData, width, height } = await this.#decode(this.file);
            this.channels = imageData.data;
            this.width = width;
            this.height = height;
            this.isReady = true;
        } catch (e) {
            console.error(e)
        }

        return this.isReady;
    }

    getPixelAt(index: number): StegPixel {
        const pixelCount = this.width * this.height;
        if (index < 0 || index >= pixelCount) {
            throw new RangeError(`'index' is ${index} but must be between 0 and ${pixelCount}`);
        }


        const pixel = new Uint8ClampedArray(STEG_CHANNEL_COUNT);
        const channelIndex = index * 4;
        pixel[0] = this.channels[channelIndex + 0] // red
        pixel[1] = this.channels[channelIndex + 1] // green
        pixel[2] = this.channels[channelIndex + 2] // blue
        pixel[3] = this.channels[channelIndex + 3] // alpha

        return new StegPixel(pixel, index);
    }

    setPixelAt(pixel: StegPixel) {
        const pixelCount = this.width * this.height;
        if (pixel.index < 0 || pixel.index >= pixelCount) {
            throw new RangeError(`'pixel index' is ${pixel.index} but must be between 0 and ${pixelCount}`);
        }

        const channelIndex = pixel.index * 4;
        this.channels[channelIndex + 0] = pixel.bytes[PixelChannels.RED]; // red
        this.channels[channelIndex + 1] = pixel.bytes[PixelChannels.GREEN]; // green
        this.channels[channelIndex + 2] = pixel.bytes[PixelChannels.BLUE]; // blue
        this.channels[channelIndex + 3] = pixel.bytes[PixelChannels.ALPHA]; // alpha
    }

    async #decode(file: File) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.crossOrigin = 'anonymous';

        try {
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = (e) => reject(e);
                img.src = url;
            });

            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                throw new Error("Failed to get canvas 2D context");
            }
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, width, height);

            return { imageData, width, height };
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    async encode() {
        const pngBytes: Uint8Array = encode({
            channels: STEG_CHANNEL_COUNT,
            depth: STEG_COLOR_DEPTH,
            data: this.channels,
            width: this.width,
            height: this.height
        });

        return pngBytes;
    }
}