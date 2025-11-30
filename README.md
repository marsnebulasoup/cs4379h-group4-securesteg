IMAGE STEGANOGRAPHY WITH AES ENCRYPTION

This project is a React + TypeScript application that hides secret messages inside images using an improved form of LSB (Least Significant Bit) steganography.
Our method uses:
-AES256 encryption
-Randomized pixel selection using the ISAAC PRNG
-Pointer based pixel chaining
-Minimal visual changes to protect against detection

User can upload an image, enter a message, generate an encoded stego image, and later decode that message using a key.

HOW IT WORKS
1. Encrypt message using AES-256
No one can read the hidden data without the key.
2. Randomly select pixels
The app does not place data in order — it scatters it.
3. Create a pointer chain
Each pixel stores: one encrypted byte, a pointer telling the decoder where the next pixel is
4. Modify pixels minimally
The app chooses pixel modifications that change the image as little as possible.
5. Decode using the key
The key contains all the information needed to rebuild the same pixel set and pointer chain.