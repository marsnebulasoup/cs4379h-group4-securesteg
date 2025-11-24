import { StegHelpers, type StegKey } from "./StegHelpers";
import { StegImage } from "./StegImage";
import isaac from 'isaac';
import type { StegPixel } from "./StegPixel";
import { DEFAULT_TOTAL_POINTERS } from "./StegEncoder";
import { WordArray } from "crypto-es";


export class StegDecoder {
    private readonly image: StegImage;
    private readonly key: WordArray;
    private readonly firstPixelIndex: number;
    private readonly aliasCount: number;
    private readonly msgLength: number;
    private readonly encodingPixelsCount: number;
    private readyToEncode: boolean;
    private readonly debug: boolean;

    constructor(image: File, key: string, debug: boolean = false) {
        this.image = new StegImage(image);

        const unpackagedKey: StegKey = StegHelpers.unpackageKey(key);
        this.key = unpackagedKey.key;
        this.firstPixelIndex = unpackagedKey.firstPixelIndex;
        this.aliasCount = unpackagedKey.aliasCount;
        this.msgLength = unpackagedKey.msgLength;

        this.encodingPixelsCount = Math.floor(DEFAULT_TOTAL_POINTERS / this.aliasCount);
        this.readyToEncode = false;
        this.debug = debug;
    }

    async prepare() {
        if (!this.readyToEncode) {
            this.readyToEncode = await this.image.prepare();
        }
        return this.readyToEncode;
    }

    async decode() {
        if (this.debug) console.log("[StegDecoder] decode() called.");
        if (!await this.prepare()) {
            console.error("[StegDecoder] Image has not been initialized yet.");
            throw new ReferenceError(`image has not been initialized yet.`);
        }

        if (this.debug) console.log(`[StegDecoder] Seeding RNG with key: ${this.key.toString()}`);
        isaac.seed(this.key.toString());
        const pixelCount = this.image.width * this.image.height;
        const uniqueIndices = new Set<number>();
        while (uniqueIndices.size < this.encodingPixelsCount) {
            uniqueIndices.add(Math.floor(isaac.random() * pixelCount));
        }
        const decodablePixels: StegPixel[] = Array.from(uniqueIndices, (idx) => this.image.getPixelAt(idx));

        if (this.debug) console.log(`[StegDecoder] Will extract ${this.msgLength} bytes, starting at firstPixelPos=${this.firstPixelIndex}`);
        const msg_e = new Uint8Array(this.msgLength);
        let currentPixel = decodablePixels[this.firstPixelIndex];

        for (let i = 0; i < this.msgLength; i++) {
            if (this.debug) {
                console.log(`\n[StegDecoder] Extracting byte ${i}:`);
                console.log(`[StegDecoder] Current pixel index: ${currentPixel.index}`);
                console.log(`[StegDecoder] Current pixel bytes: ${currentPixel.bytes}`);
            }
            msg_e[i] = currentPixel.bytes[0];
            currentPixel = decodablePixels[StegHelpers.next_pixel_idx(this.key, currentPixel.pointer.wordArray, decodablePixels.length)];
        }

        if (this.debug) console.log("[StegDecoder] Message bytes extracted (encrypted):", msg_e);

        if (this.debug) console.log("[StegDecoder] Attempting to decrypt...");
        const msg = StegHelpers.aes_decrypt(this.key, msg_e);
        if (this.debug) console.log("[StegDecoder] Decryption complete.");
        return msg;
    }
}