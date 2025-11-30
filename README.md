IMAGE STEGANOGRAPHY WITH AES ENCRYPTION

This project is a React + TypeScript application that hides secret messages inside images using an improved form of LSB (Least Significant Bit) steganography.
Our method uses:
-AES256 encryption
-Randomized pixel selection using the ISAAC PRNG
-Pointer based pixel chaining
-Minimal visual changes to protect against detection

User can upload an image, enter a message, generate an encoded stego image, and later decode that message using a key.