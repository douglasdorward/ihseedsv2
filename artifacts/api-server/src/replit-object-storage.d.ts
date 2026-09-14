declare module "@replit/object-storage" {
  export class Client {
    uploadFromBytes(name: string, contents: Buffer): Promise<{ ok: boolean; error?: unknown }>;
    downloadAsBytes(name: string): Promise<{ ok: boolean; value?: Buffer | Uint8Array; error?: unknown }>;
    delete(name: string): Promise<{ ok: boolean }>;
  }
}
