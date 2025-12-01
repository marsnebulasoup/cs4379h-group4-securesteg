/**
 * StegEncoder
 * ---------------
 * This class performs the encoding phase of our steganography system.
 * It hides an encrypted message inside an image using:
 *   - AES-256 encryption
 *   - Randomized pixel selection using the ISAAC PRNG
 *   - Pointer-based pixel chaining
 *   - Minimal visual modifications to avoid detection
*/


import { WordArray } from 'crypto-es'
import { StegHelpers } from './StegHelpers';
import { StegImage } from './StegImage';
import { PixelChannels, StegPixel } from './StegPixel';
import isaac from 'isaac';
import { POINTER_CHANNEL_COUNT, StegPointer } from './StegPointer';


export const DEFAULT_TOTAL_POINTERS = 2 ** (8 * POINTER_CHANNEL_COUNT) // 2 channels reserved for the pointer, where each channel is 1 byte = 8 bits, so 16 bits total
export const DEFAULT_POINTER_ALIASES = 32; // if we split 2**16 = 65,536 pointer options into 32 bins, we can have 65536/32 = 2048 pixels to choose from in our set, where 32 different pointers will point to the same pixel (on avg)

export type EncodeStats = {
    pixelsTotal: number;
    pixelsEncoded: number;
    pixelsModified: number;
    channelsModified: number; // equals bytesModified
    bytesModified: number;
    percentPixelsModified: number; // over entire image
};

export type EncodeProgressCallback = (progress01: number, phase?: string) => void | Promise<void>;


export class StegEncoder {
    private readonly image: StegImage;
    private readonly message: string;
    private readonly key: WordArray;
    private readyToEncode: boolean;
    private readonly aliasCount: number;
    private readonly debug: boolean;

    constructor(image: File, message: string, aliasCount: number = DEFAULT_POINTER_ALIASES, debug: boolean = false) {
        this.image = new StegImage(image);
        this.message = message; // ascii
        this.key = StegHelpers.generate_key();
        this.aliasCount = aliasCount;
        this.readyToEncode = false;
        this.debug = debug;
    }

    private dbg(...args: unknown[]) {
        if (this.debug) console.log(...args);
    }
    private wrn(...args: unknown[]) {
        if (this.debug) console.warn(...args);
    }

    // Computes encoding statistics for the provided set of encoded pixels.
    // Stats include image-wide counts and per-encoded-pixel bit modifications.
    private computeEncodeStats(encodedPixels: StegPixel[]): EncodeStats {
        // Deduplicate to the final state per index (last write wins)
        const indexToPixel = new Map<number, StegPixel>();
        for (const p of encodedPixels) {
            indexToPixel.set(p.index, p);
        }
        const uniquePixels = Array.from(indexToPixel.values());
        const pixelsEncoded = uniquePixels.length;
        const pixelsModified = uniquePixels.reduce((acc, p) => acc + (p.modified ? 1 : 0), 0);

        let channelsModified = 0;
        for (const p of uniquePixels) {
            for (let i = 0; i < p.bytes.length; i++) {
                const before = p.originalBytes[i];
                const after = p.bytes[i];
                if (before !== after) {
                    channelsModified += 1;
                }
            }
        }
        const pixelsTotal = this.image.width * this.image.height;
        return {
            pixelsTotal,
            pixelsEncoded,
            pixelsModified,
            channelsModified,
            bytesModified: channelsModified,
            percentPixelsModified: pixelsTotal > 0 ? (pixelsModified / pixelsTotal) * 100 : 0
        };
    }

    async prepare() {
        if (!this.readyToEncode) {
            this.readyToEncode = await this.image.prepare();
        }
        return this.readyToEncode;
    }

    async encode(onProgress?: EncodeProgressCallback) {
        const report = async (p: number, phase?: string) => {
            if (onProgress) {
                const clamped = Math.max(0, Math.min(1, p));
                await onProgress(clamped, phase);
            }
        };
        this.dbg("[StegEncoder] encode() called.");
        if (!await this.prepare()) {
            console.error("[StegEncoder] Image has not been initialized yet.");
            throw new ReferenceError(`image has not been initialized yet.`);
        }

        // encrypt the message
        this.dbg("[StegEncoder] Using unified key for RNG, pointers, and encryption...");
        const key: WordArray = this.key;

        this.dbg(`[StegEncoder] Encrypting message. Plaintext length: ${this.message.length}`);
        await report(0.05, "Encrypting message");
        const msg_e: Uint8Array = StegHelpers.aes_encrypt(key, this.message);
        this.dbg(`[StegEncoder] Encrypted message length: ${msg_e.length} bytes`);
        this.dbg(`[StegEncoder] Encrypted message: ${msg_e}`);

        // ensure we have enough encodable positions for the encrypted length
        let effectiveAliasCount = this.aliasCount;
        let effectiveEncodingPixelsCount = Math.floor(DEFAULT_TOTAL_POINTERS / effectiveAliasCount);
        if (effectiveEncodingPixelsCount < msg_e.length) {
            effectiveAliasCount = Math.max(1, Math.floor(DEFAULT_TOTAL_POINTERS / msg_e.length));
            effectiveEncodingPixelsCount = Math.floor(DEFAULT_TOTAL_POINTERS / effectiveAliasCount);
            this.wrn(`[StegEncoder] Adjusted aliasCount to ${effectiveAliasCount} to satisfy msg length (${msg_e.length}) -> encodable positions ${effectiveEncodingPixelsCount}`);
        }

        // get this.encodingPixelsCount pixels
        this.dbg(`[StegEncoder] Seeding RNG for pixel selection with: ${this.key.toString()}`);
        isaac.seed(this.key.toString());
        this.dbg(`[StegEncoder] Gathering ${effectiveEncodingPixelsCount} encodable pixels...`);
        const pixelCount = this.image.width * this.image.height;
        // If message is longer than the total number of pixels, encoding is impossible
        if (msg_e.length > pixelCount) {
            throw new Error(`Message too long for this image: need at least ${msg_e.length} pixels, but image has ${pixelCount}.`);
        }
        const targetCount = Math.min(effectiveEncodingPixelsCount, pixelCount);
        const uniqueIndices = new Set<number>();
        while (uniqueIndices.size < targetCount) {
            uniqueIndices.add(Math.floor(isaac.random() * pixelCount));
        }
        const encodablePixels: StegPixel[] = Array.from(uniqueIndices, (idx) => this.image.getPixelAt(idx));
        this.dbg("[StegEncoder] Encodable pixels fetched.");
        await report(0.15, "Selecting pixels");
        const encodedPixels: StegPixel[] = [];

        // generate all possible pointer values (16 bits: 0..65535), encoded as 2 bytes each
        this.dbg(`[StegEncoder] Generating all ${DEFAULT_TOTAL_POINTERS} pointer values...`);
        const allPointers: StegPointer[] = Array.from({ length: DEFAULT_TOTAL_POINTERS }, (_, p) => new StegPointer(new Uint8ClampedArray([(p >> 8) & 0xFF, p & 0xFF])));
        this.dbg("[StegEncoder] All pointer values generated.");
        await report(0.2, "Preparing pointers");

        // set the last pixel
        this.dbg("[StegEncoder] Selecting best last pixel (closest match to last msg byte)...");
        let currentPixel = encodablePixels
            .slice()
            .sort((a, b) =>
                Math.abs(a.bytes[PixelChannels.RED] - msg_e[msg_e.length - 1]) -
                Math.abs(b.bytes[PixelChannels.RED] - msg_e[msg_e.length - 1])
            )[0];
        this.dbg(`[StegEncoder] Last pixel before modification. Index: ${currentPixel.index}, Value:`, currentPixel.bytes);
        currentPixel.setChannel(PixelChannels.RED, msg_e[msg_e.length - 1]);
        this.dbg(`[StegEncoder] Last pixel after setting RED=${msg_e[msg_e.length - 1]}:`, currentPixel.bytes);
        encodedPixels.push(currentPixel);
        // Track the array positon of the currentPixel within encodablePixels
        let currentPos = encodablePixels.findIndex(p => p.index === currentPixel.index);
        const usedPositions = new Set<number>([currentPos]);

        // create the pointer chain, where each node is one message byte
        const totalInner = Math.max(1, msg_e.length - 1);
        for (let i = msg_e.length - 2; i >= 0; i--) {
            this.dbg(`\n\n[StegEncoder] --- Encoding byte ${i}: ${msg_e[i]} ---`);
            this.dbg("[StegEncoder] Needs to point to pixel (array pos -> image index):", currentPos, "->", currentPixel.index);

            const byte = msg_e[i];

            this.dbg(`[StegEncoder] Searching for previous pixels with RED=${byte}...`);
            // Prefer exact RED matches first, but we will fall back to any unused pixel
            const exactMatchPixels = encodablePixels.filter(pixel => pixel.bytes[PixelChannels.RED] === byte);
            const fallbackPixels = encodablePixels
                .filter(p => !exactMatchPixels.includes(p)) // exclude exact matches to avoid duplicates
                .slice()
                .sort((a, b) =>
                    Math.abs(a.bytes[PixelChannels.RED] - byte) -
                    Math.abs(b.bytes[PixelChannels.RED] - byte)
                );
            const candidatePixels = [...exactMatchPixels, ...fallbackPixels];
            this.dbg(`[StegEncoder] Candidate previous pixels (exact first): ${candidatePixels.length}, ${JSON.stringify(candidatePixels.slice(0, 5).map(p => { return {index: p.index, bytes: p.bytes}}))}...`);

            this.dbg("[StegEncoder] Filtering possible pointers...");
            const possiblePreviousPointers = allPointers.filter(
                p => StegHelpers.next_pixel_idx(
                    key,
                    p.wordArray,
                    encodablePixels.length
                ) === currentPos
            );
            this.dbg(`[StegEncoder] Found ${possiblePreviousPointers.length} possible previous pointers.`);

            let bestPixel: StegPixel | null = null;
            let bestPixelDistance = Infinity; // super high initial distance
            let bestPos: number | null = null;

            outer:
            for (let pixel_idx = 0; pixel_idx < candidatePixels.length; pixel_idx++) {
                const pixel = candidatePixels[pixel_idx];                
                const pos = encodablePixels.findIndex(p => p.index === pixel.index);
                if (pos === -1 || usedPositions.has(pos)) continue;

                // build modifiedPixel, evaluate distance, pick best...
                const original = pixel;
                const originalPtr = original.pointer;

                for (const possiblePtr of possiblePreviousPointers) {
                    // Perfect match: RED already equals byte and pointer equals required pointer
                    if (original.bytes[PixelChannels.RED] === byte && originalPtr.equals(possiblePtr)) {
                        this.dbg(`[StegEncoder] Found perfect match (index ${original.index})`);
                        bestPixel = original;
                        bestPixelDistance = 0;
                        bestPos = pos;
                        break outer;
                    }

                    // Otherwise, compute minimally modified candidate:
                    // - set RED to the desired byte
                    // - set pointer bytes to the candidate possiblePtr
                    const modifiedPixel = new StegPixel(original.bytes, original.index);
                    modifiedPixel.setChannel(PixelChannels.RED, byte);
                    modifiedPixel.setPointer(possiblePtr);

                    const modifiedPixelDistance = original.similarity(modifiedPixel);

                    if (modifiedPixelDistance < bestPixelDistance) {
                        this.dbg(`[StegEncoder] New best candidate: updating pixel ${modifiedPixel.index} pointer to [${possiblePtr.bytes}] (distance: ${modifiedPixelDistance})`);
                        bestPixel = modifiedPixel;
                        bestPixelDistance = modifiedPixelDistance;
                        bestPos = pos;
                    }
                }

            }

            if (!bestPixel) {
                console.error("[StegEncoder] No suitable pixel found for byte", byte, "at position", i);
                throw new Error('Invariant violated: bestPixel should have been selected');
            }
            encodedPixels.push(bestPixel);
            currentPixel = bestPixel;
            currentPos = bestPos as number;
            usedPositions.add(currentPos);
            this.dbg(`[StegEncoder] Encoded pixel for msg[${i}]: index ${bestPixel.index}`);
            const processed = (msg_e.length - 2) - i + 1; // count how many inner iterations are done
            const frac = processed / totalInner;
            // Map progress from 0.2..0.95 during core encoding
            const prog = 0.2 + frac * 0.75;
            await report(prog, `Encoding bytes (${processed}/${totalInner})`);
        }

        // modify image (if needed)
        await report(0.96, "Writing pixels to image");
        encodedPixels.forEach(pixel => this.image.setPixelAt(pixel));

        // compute encoding statistics
        const stats: EncodeStats = this.computeEncodeStats(encodedPixels);

        // package key
        this.dbg(`[StegEncoder] Packaging key and associated metadata...`);
        await report(0.98, "Packaging key");
        const packagedKey = StegHelpers.packageKey({
            key: key,
            aliasCount: effectiveAliasCount,
            firstPixelIndex: currentPos,
            msgLength: msg_e.length
        });
        this.dbg(`[StegEncoder] Key packaged: ${packagedKey}`);

        // return key + modified image
        this.dbg("[StegEncoder] Encoding complete, returning result...");
        await report(1, "Done");
        return {
            key: packagedKey,
            image: await this.image.encode(),
            stats
        }
    }
}