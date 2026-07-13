/// <reference lib="webworker" />

import { stringifyCatalog, type LibraryPhoto } from "./catalog";

self.onmessage = (event: MessageEvent<LibraryPhoto[]>) => {
  self.postMessage(stringifyCatalog(event.data));
};
