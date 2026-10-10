/**
 * `upng-js` ships no types of its own.
 *
 * Only what the app actually uses is declared here, so the surface stays honest:
 * the probe decodes one small PNG per frame (`decode` + `toRGBA8`), and the tests
 * encode their synthetic frames with `encode` instead of keeping binary fixtures
 * in the repository.
 *
 * `decode` takes a buffer, not a `Uint8Array` — `base64ToBytes` allocates a fresh
 * one per frame, so the whole buffer is the image's own and there is no offset to
 * slice off.
 */
declare module 'upng-js' {
  export type UpngImage = {
    width: number;
    height: number;
    depth: number;
    /** PNG colour type: 0 grey, 2 RGB, 3 palette, 4 grey+alpha, 6 RGBA. */
    ctype: number;
    frames: unknown[];
  };

  export function decode(buffer: ArrayBufferLike): UpngImage;

  /** Decodes every frame to RGBA; the app only ever uses the first. */
  export function toRGBA8(image: UpngImage): ArrayBuffer[];

  /** `cnum` 0 keeps the image lossless. Returns the encoded PNG as an ArrayBuffer. */
  export function encode(
    buffers: ArrayBufferLike[],
    width: number,
    height: number,
    cnum: number,
  ): ArrayBuffer;
}
