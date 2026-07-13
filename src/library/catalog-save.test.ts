import { describe, expect, it } from "vitest";
import { saveCatalogUnlessCancelled } from "./catalog-save";

describe("catalog auto-save cancellation", () => {
  it("does not enqueue a stale auto-save when close starts during serialization", async () => {
    let closing = false;
    let finishSerialization!: (contents: string) => void;
    const saved: string[] = [];
    const pending = saveCatalogUnlessCancelled(
      () => new Promise((resolve) => { finishSerialization = resolve; }),
      () => closing,
      async (contents) => { saved.push(contents); },
    );
    closing = true;
    finishSerialization("stale");
    await pending;
    expect(saved).toEqual([]);
  });
});
