import { WordArray } from "crypto-es";
import type { Pixel } from "./StegPixel";

export type Pointer = Uint8ClampedArray;
export const POINTER_CHANNEL_COUNT = 2;

export class StegPointer {
    public readonly bytes: Pointer;
    constructor(from: Pixel | Pointer) {
        if (from.length > POINTER_CHANNEL_COUNT) {
            this.bytes = from.slice(1, 1 + POINTER_CHANNEL_COUNT); // take POINTER_CHANNEL_COUNT channels, skipping the first element
        } else if (from.length === POINTER_CHANNEL_COUNT) {
            this.bytes = from.slice(); // converting from an existing pointer
        }
        else {
            throw new RangeError(`Cannot create a pointer with POINTER_CHANNEL_COUNT = ${POINTER_CHANNEL_COUNT}, because the inputted pixel only has ${from.length} channels. Please reduce POINTER_CHANNEL_COUNT or input a pixel with more channels.`)
        }
    }

    get wordArray() {
        return WordArray.create(this.bytes)
    }

    equals(other: StegPointer) {
        return this.bytes.length === other.bytes.length && this.bytes.every((value, index) => value === other.bytes[index]);
    }

    similarity(other: StegPointer) { // euclidean distance
        if (this.bytes.length !== other.bytes.length) {
            throw new RangeError("Pointers must have the same length to calculate similarity.");
        }
        const sum = this.bytes.reduce((total, ptr, i) => total + (ptr - other.bytes[i]) ** 2, 0);
        return Math.sqrt(sum);
    }
}