declare module 'pixelmatch' {
  export default function pixelmatch(
    img1: Buffer | Uint8Array,
    img2: Buffer | Uint8Array,
    output: Buffer | Uint8Array,
    width: number,
    height: number,
    options?: {
      threshold?: number;
      alpha?: number;
      includeAA?: boolean;
    },
  ): number;
}

declare module 'pngjs' {
  export class PNG {
    constructor(options?: { width?: number; height?: number; filterType?: number });
    data: Buffer;
    width: number;
    height: number;
    static sync: {
      read(buffer: Buffer): PNG;
      write(png: PNG, options?: { colorType?: number }): Buffer;
    };
  }
}
