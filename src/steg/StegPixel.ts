import { POINTER_CHANNEL_COUNT, StegPointer } from "./StegPointer";

export type Pixel = Uint8ClampedArray;

export const PixelChannels = {
    RED: 0,
    GREEN: 1,
    BLUE: 2,
    ALPHA: 3
} as const;
export type PixelChannels = typeof PixelChannels[keyof typeof PixelChannels];

export class StegPixel {
    public readonly bytes: Pixel;
    public readonly originalBytes: Pixel;
    public readonly index: number;
    private _pointer: StegPointer;

    constructor(pixel: Pixel, index: number) {        
        // Clone the incoming pixel to avoid shared references between StegPixel instances
        this.bytes = pixel.length === 4 ? pixel.slice() : new Uint8ClampedArray(4); // [red, green, blue, alpha]
        this.originalBytes = this.bytes.slice();
        this.index = index;
        this._pointer = new StegPointer(pixel);
    }

    static includedInPixelArray(array: StegPixel[], item: StegPixel) {
        return !!array.find(pixel => pixel.equals(item));
    }

    static excludedFromPixelArray(array: StegPixel[], item: StegPixel) {
        return !this.includedInPixelArray(array, item);
    }
    
    static includesIndex(array: StegPixel[], index: number) {
        return array.some(pixel => pixel.index === index);
    }

    static excludesIndex(array: StegPixel[], index: number) {
        return !this.includesIndex(array, index);
    }

    get pointer(): StegPointer {
        return this._pointer;
    }

    get modified(): boolean {
        if (this.bytes.length !== this.originalBytes.length) {
            return true;
        }
        return this.bytes.some((value, index) => value !== this.originalBytes[index]);
    }

    setChannel(channel: PixelChannels, value: number) {
        this.bytes[channel] = value;
        this._pointer = new StegPointer(this.bytes);
    }

    setPointer(pointer: StegPointer) {
        // Write only the pointer channels (GREEN and BLUE when POINTER_CHANNEL_COUNT = 2)
        for (let i = 0; i < POINTER_CHANNEL_COUNT; i++) {
            this.bytes[1 + i] = pointer.bytes[i];
        }
        this._pointer = pointer;
    }

    equals(other: StegPixel) {
        return this.bytes.length === other.bytes.length && this.bytes.every((value, index) => value === other.bytes[index]);
    }    

    similarity(other: StegPixel) { // euclidean distance
        if (this.bytes.length !== other.bytes.length) {
            throw new RangeError("Pixels must have the same channel count to calculate similarity.");
        }
        const sum = this.bytes.reduce((total, ptr, i) => total + (ptr - other.bytes[i]) ** 2, 0);
        return Math.sqrt(sum);
    }
}