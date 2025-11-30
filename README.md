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

HOW TO RUN THIS APPLICATION
1. Clone the repo
git clone <https://github.com/marsnebulasoup/cs4379h-group4-securesteg.git>
cd cs4379h-group4-securesteg
2. Install dependecies
npm install
3. Start development server
npm run dev
4. Open the app
click http://localhost:5173/

USING THE APP-Encoding
1. Go to the Encode tab
2. Upload an image
3. Type a secret message
4. Click Encrypt & Hide Message
5. Save the encoded image and the decryption key (required to decode later)

USING THE APP-decoding
1. Go to the Decode tab
2. Upload your encoded image
3. Paste the decryption key
4. Click Decode Message
5. Your hidden message will appear if the key is correct
