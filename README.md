# POINTER CHAIN IMAGE STEGANOGRAPHY WITH AES ENCRYPTION

This project is a React + TypeScript demo application that hides secret messages inside images using a custom form of pointer chain steganography.

Our method uses:
- AES256 encryption
- Randomized pixel selection using the ISAAC PRNG
- Pointer based pixel chaining
- Minimal visual changes to protect against detection

User can upload an image, enter a message, generate an encoded stego image, and later decode that message using a key.

## BACKGROUND
Traditional LSB steganography embeds data sequentially, often modifying the least significant bits of pixels. This introduces predictable statistical anomalies, such as pairs of values in the histogram, which are susceptible to steganalysis attacks.

To help reduce these vulnerabilities, this project implements a randomized embedding scheme inspired by *Pixel Locator Sequences* described in the source paper, *LSB Steganography Using Pixel Locator Sequence with AES*. Instead of sequential embedding, we generate a pseudorandom subset of pixels using a cryptographic seed, separating the embedding order from the image structure. We use a pointer-chaining strategy, where the location of the $(i+1)^{th}$ pixel is derived from the data stored in the $i^{th}$ pixel, effectively creating a linked list scattered across the image. This approach, combined with an algorithm that minimizes local pixel distortion, significantly increases resistance to visual and statistical detection.

## ALGORITHM DETAILS (full breakdown in steg/algorithm.md)

### Encoding Process
The encoding process constructs a linked chain of pixels in reverse order (from the last byte of the message to the first).

1. The input message is encrypted using AES-256 with a random key $K$. This key $K$ also seeds the ISAAC CSPRNG to select a candidate subset of pixels $S$ from the image. The size of this subset, $|S|$, is maximized based on the image dimensions and the pointer aliasing factor $t$.

2. We utilize 16 bits for the pointer (stored in the Green and Blue channels), providing $Q = 2^{16} = 65,536$ distinct pointer values. To increase the probability of finding a visually similar pixel match, we use an aliasing method where multiple pointer values map to the same target pixel index. Based on the message length, we can determine the maximum alias count possible by dividing $Q$ by the message length.

3. The algorithm iterates backwards through the encrypted message bytes. For a current byte $b_i$ and the previously processed pixel index $idx_{next}$, we search for a pixel $P_{curr}$ in $S$ and a pointer value $p$ such that:
   - The Red channel of $P_{curr}$ stores $b_i$.
   - The Green and Blue channels of $P_{curr}$ store $p$.
   - The pointer mapping function determines this pixel points to the next pixel: `next_pixel_idx(K, p) == idx_{next}`.

4. The mapping function is defined as `next_pixel_idx(K, p) = first_16_bits(HMAC_SHA256(K, p)) mod |S|`. From the set of valid pointers $p$ and available pixels in $S$, we select the specific configuration that minimizes the Euclidean distance between the original pixel color and the modified pixel color. This optimization ensures minimal visual distortion.

5. The final output includes the modified image and a key structure containing $K$, $t$, the index of the starting pixel, and the message length $L$.

### Decoding Process
Decoding traverses the chain forward.

1. The receiver extracts $K$, $t$, `first_pixel_index`, and $L$ from the provided key string. $K$ is used to re-initialize the same CSPRNG state and reconstruct the identical pixel subset $S$.

2. Starting from `first_pixel_index`, the algorithm extracts the message byte from the Red channel and the pointer $p$ from the Green and Blue channels.

3. The next pixel location is computed using `next_pixel_idx(K, p)`, allowing the traversal to jump to the exact location of the next data segment in $S$.

4. This process repeats for $L$ iterations to reconstruct the encrypted bytes, which is finally decrypted using AES-256 to reveal the plaintext.

## EXPERIMENTAL OBSERVATIONS
The effectiveness of the algorithm was observed through histogram analysis and parameter tuning.

1. Comparisons between cover images and stego-images show almost perfectly aligned histograms. This indicates that the embedding process introduces negligible differences, maintaining the cover image's profile.

![](/src/assets/run1.png)
![](/src/assets/histogram.png)

2. We observed that adjusting the alias count $t$ (the number of pointers mapping to the same pixel) presents a trade-off but results in consistently low distortion.
   - **Higher $t$:** Increases the number of valid pointer values $(G, B)$ for a given target, offering more flexibility in the Green and Blue channels. However, it reduces the size of the pixel pool $|S|$, limiting options for the Red channel and spatial location.
   - **Lower $t$:** Increases the pixel pool size $|S|$, offering more candidate pixels (better spatial/Red channel matches) but restricts the valid pointer values.
   - **Result:** In practice, both configurations yield effective steganography, as the algorithm successfully finds minimal-distortion embeddings in either regime.



## HOW TO RUN THIS APPLICATION
1. Clone the repo
```
git clone https://github.com/marsnebulasoup/cs4379h-group4-securesteg.git
cd cs4379h-group4-securesteg
```
2. Install dependecies
```
npm install
```
3. Start development server
```
npm run dev
```
4. Open the app
```
http://localhost:5173/ (or whatever link is shown)
```

You can use the test image in /example-images, or pick your own (PNG is supported)


## USING THE APP - Encoding
1. Go to the Encode tab
2. Upload an image
3. Type a secret message
4. Click Encrypt & Hide Message
5. Save the encoded image and the decryption key (required to decode later)

## USING THE APP - Decoding
1. Go to the Decode tab
2. Upload your encoded image
3. Paste the decryption key
4. Click Decode Message
5. Your hidden message will appear if the key is correct


## REFERENCES
1. LSB Steganography Using Pixel Locator Sequence with AES — describes the randomized pixel-locator method that inspired our implementation.
2. Johnson, Neil F., and Sushil Jajodia. “Exploring Steganography: Seeing the Unseen.” IEEE Computer, 1998.- explains why traditional LSB steganography is easy to detect, which our project solves. The paper explains that attackers can find hidden data by checking predictable positions, we break this weakness by: randomly selecting pixels using ISAAC, never embedding in sequence, creating a pointer-based pixel chain. LSB creates detectable patterns with histogram distortion and patterns in colors, but we minimize visual distortion by selecting pixels whose modified values stay closest to the original using a similarity score and spread changes across the image instead of clustering them.
