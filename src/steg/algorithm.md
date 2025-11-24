Encoding follows these steps:
    1. Given a message, we generate a random key K and encrypt with AES to get msg_e. Note that msg_e must be small (~2kb) to avoid having to modify the image
    2. We load an image for encoding, and obtain every pixel / channel (a channel = a byte)
    3. The idea is to build a chain of pixels, where each pixel contains:
        a. One byte of the encrypted text in the first channel
        b. The first byte of a pointer value to the next pixel
        c. The second byte of a pointer value to the next pixel
    4. This gives us Q = two bytes = 2^16 = 65,536 values for possible pointers.
    5. We break the Q pointers down into t blocks. This allows t pointers (in the same block) to point to the same next pixel, giving us more options to find 
       matching pixels in the image, given the first channel is the encrypted text.
    6. The number of pixels aka bytes (since one byte of the message is per px) we can encode depends on t: |S| = Q/t. 
        - More pointers per block (bigger t) result in a shorter max message length, but it would be easier to find matches for a given byte of encrypted text
        - Less pointers per block (smaller t) result in a greater max message length, but it would be harder to find matches for a given byte of encrypted text
        S is an array which would contain |S| = Q/t random pixels, pulled using a CSPRNG seeded with K
    7. To encode, we work backwards using a keyed function and the pointer values to determine the next pixel:
        next_pixel_idx(K, p) =  first_16_bits( HMAC_SHA256(K, p) ) mod len(S)
    8. Encoding loop:
        Find a pixel in S which contains msg_e[last byte] in the first channel. This will be the last pixel.
        Let last_pixel_idx equal this pixel's index
        Let used_pixels = [last_pixel_idx]
        For each next encrypted byte msg_e backwards:
            Pull all pixels in S where the first channel equals msg_e
            Let possible_pointers = [p for p in 0..Q-1 where next_pixel_idx(K, p) == last_pixel_idx]
            Let best_pixel_idx = null
            Let best_pixel_ptr = null
            For each pixel pos:
                Pointer p = pos[channel 2] || pos[channel 3]
                If p in possible_pointers, we found a match: 
                    set best_pixel_idx = pos idx 
                    set brest_pixel_ptr = p
                    break
                Otherwise, if p matches any possible pointer closer than best_pixel does, 
                    set best_pixel_idx = pos idx
                    set best_pixel_ptr = p
            Write best_pixel_ptr to S[best_pixel_idx] channels 2 and 3. Ideally, the best pixel will already have channels 2 and 3 equal to the pointer, 
            and we won't have to write anything
            Let last_pixel_idx = best_pixel_idx
            Append last_pixel_idx to used_pixels
        Let first_pixel_index = last_pixel_index
    9. The final output will be the modified image, and a key K_out = K || t || first_pixel_idx || L. The length is needed for decoding to know when we have 
       reached the end pixel and equals len(msg_e)

Decoding follows these steps:
    1. Given an image and key K_in (which is K_out from encoding), we split K_in into K and t and first_pixel_idx and L (K is of known length, and so is t and first_pixel_idx)
    2. Utilize K to populate S, an array which would contain |S| = Q/t random pixels, pulled using a CSPRNG seeded with K
    3. Let msg_e = null
    4. Set current_pixel = S[first_pixel_index]
    5. msg_e += current_pixel[channel 1]
    6. For _ in 0..L - 1
        Let p = current_pixel[channel 2] || current_pixel[channel 3]
        current_pixel = S[next_pixel_idx(K, p)]
        msg_e += current_pixel[channel 1]
    7. Decrypt msg_e using K with AES
    8. Output the final message
