import { AESAlgo, HmacSHA256, PBKDF2, WordArray, Hex, Utf8 } from "crypto-es";

export interface StegKey {
    key: WordArray;
    firstPixelIndex: number;
    aliasCount: number;
    msgLength: number;
}

export class StegHelpers {
    static generate_key(): WordArray {
        const password = WordArray.random(256 / 8); // random password and
        const salt = WordArray.random(256 / 8)      // salt currently
        const K = PBKDF2(password, salt, { keySize: 256 / 32, iterations: 10 ** 6 });
        return K;
    }

    static aes_encrypt(K: WordArray, msg: string): Uint8Array {
        const aes = AESAlgo.createEncryptor(K);
        const msgWa = Utf8.parse(msg);
        const ctWa = aes.process(msgWa).concat(aes.finalize());
        return StegHelpers.wordArrayToUint8Array(ctWa);
    }

    static next_pixel_idx(K: WordArray, p: WordArray, S_len: number): number {
        // next_pixel_idx(K, p, S) =  first_16_bits( HMAC_SHA256(K, p) ) mod len(S)
        const mac = HmacSHA256(p, K);
        const word = mac.words[0]; // 32 bits
        const first_16_bits = (word >>> 16) & 0xffff; // shift all bits right by 16 bits so that only the first 16 bits remain, then mask with 0xffff (contains 1's in last 16 bits only)
        return first_16_bits % S_len
    }

    static packageKey(keyObj: StegKey): string {
        return keyObj.key.toString() // 64 hex chars (256 bit)
            + keyObj.aliasCount.toString(16).padStart(4, "0") // 4 hex chars
            + keyObj.msgLength.toString(16).padStart(4, "0")  // 4 hex chars
            + keyObj.firstPixelIndex.toString(16) // depends on image size and what first pixel was chosen (probably ~6 chars)
    }

    static unpackageKey(packed: string): StegKey {
        const s = packed.trim();
        if (s.length < 72) {
            throw new RangeError("Packed key is too short.");
        }

        const keyHex = s.slice(0, 64);   // 32-byte key (64 hex chars)
        const aliasHex = s.slice(64, 68); // 2 bytes (4 hex chars)
        const lenHex = s.slice(68, 72);   // 2 bytes (4 hex chars)
        const firstHex = s.slice(72);     // remaining hex for firstPixelIndex

        return {
            key: Hex.parse(keyHex),
            aliasCount: parseInt(aliasHex, 16),
            msgLength: parseInt(lenHex, 16),
            firstPixelIndex: parseInt(firstHex, 16),
        };
    }

    static aes_decrypt(K: WordArray, ciphertextBytes: Uint8Array) {
        const aes = AESAlgo.createDecryptor(K);
        const ctWa = StegHelpers.uint8ArrayToWordArray(ciphertextBytes);
        const ptWa = aes.process(ctWa).concat(aes.finalize());
        return ptWa;
    }

    static wordArrayToUint8Array(wa: WordArray): Uint8Array {
        const { words, sigBytes } = wa;
        const u8 = new Uint8Array(sigBytes);
        for (let i = 0; i < sigBytes; i++) {
            u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        }
        return u8;
    }

    static uint8ArrayToWordArray(u8: Uint8Array): WordArray {
        const words: number[] = [];
        for (let i = 0; i < u8.length; i++) {
            words[i >>> 2] = (words[i >>> 2] || 0) | (u8[i] << (24 - (i % 4) * 8));
        }
        return new WordArray(words, u8.length);
    }
}