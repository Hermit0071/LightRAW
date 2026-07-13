import { stringifyCatalog, type LibraryPhoto } from "./catalog";

export function stringifyCatalogAsync(photos: LibraryPhoto[]): Promise<string> {
  const metadata = photos.map((photo) => ({ ...photo, thumbnail: null }));
  if (typeof Worker === "undefined") return Promise.resolve(stringifyCatalog(metadata));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./catalog-serializer.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<string>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "图库后台序列化失败"));
    };
    worker.postMessage(metadata);
  });
}
