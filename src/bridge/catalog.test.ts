import { describe, expect, it } from "vitest";
import { enqueueCatalogSave } from "./catalog";

describe("catalog save queue", () => {
  it("finishes a close snapshot after an already running automatic save", async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const first = enqueueCatalogSave(async () => {
      events.push("first-start");
      await new Promise<void>((resolve) => { releaseFirst = resolve; });
      events.push("first-end");
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const close = enqueueCatalogSave(async () => { events.push("close"); });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual(["first-start"]);
    releaseFirst();
    await Promise.all([first, close]);
    expect(events).toEqual(["first-start", "first-end", "close"]);
  });
});
