import { describe, expect, it } from "vitest";
import { commitHistory, commitTransaction, createHistory, redoHistory, resetHistory, undoHistory } from "./history";

describe("non-destructive edit history", () => {
  it("walks backward and forward through committed recipes", () => {
    let history = createHistory({ exposure: 0 });
    history = commitHistory(history, { exposure: 1 });
    history = commitHistory(history, { exposure: 2 });

    history = undoHistory(history);
    expect(history.present.exposure).toBe(1);
    history = undoHistory(history);
    expect(history.present.exposure).toBe(0);
    history = redoHistory(history);
    expect(history.present.exposure).toBe(1);
  });

  it("drops the redo branch after a new edit and resets per photo", () => {
    let history = commitHistory(createHistory({ value: 0 }), { value: 1 });
    history = undoHistory(history);
    history = commitHistory(history, { value: 4 });
    expect(redoHistory(history).present.value).toBe(4);
    expect(resetHistory(history, { value: 9 })).toEqual(createHistory({ value: 9 }));
  });

  it("caps retained snapshots without losing the current recipe", () => {
    let history = createHistory({ value: 0 });
    for (let value = 1; value <= 150; value += 1) history = commitHistory(history, { value });
    expect(history.past).toHaveLength(100);
    expect(history.present.value).toBe(150);
  });

  it("folds every preview update in one gesture into one undo step", () => {
    const initial = { exposure: 0 };
    let history = createHistory(initial);
    for (let index = 1; index <= 150; index += 1) history = { ...history, present: { exposure: index / 150 } };
    history = commitTransaction(history, initial);
    expect(history.past).toEqual([initial]);
    expect(undoHistory(history).present).toEqual(initial);
  });

  it("commits a text transaction before a following pointer transaction", () => {
    let history = createHistory({ name: "Layer", opacity: 1 });
    const textBaseline = history.present;
    history = { ...history, present: { ...history.present, name: "Sky" } };
    history = commitTransaction(history, textBaseline);
    const pointerBaseline = history.present;
    for (let index = 1; index <= 150; index += 1) history = { ...history, present: { ...history.present, opacity: 1 - index / 300 } };
    history = commitTransaction(history, pointerBaseline);
    expect(history.past).toEqual([{ name: "Layer", opacity: 1 }, { name: "Sky", opacity: 1 }]);
  });

  it("isolates a newly opened photo from an unfinished previous transaction", () => {
    let history = createHistory({ photo: "old", exposure: 0 });
    const baseline = history.present;
    history = { ...history, present: { photo: "old", exposure: 1 } };
    history = commitTransaction(history, baseline);
    history = resetHistory(history, { photo: "new", exposure: 0 });
    history = commitHistory(history, { photo: "new", exposure: 1 });
    expect(undoHistory(history).present).toEqual({ photo: "new", exposure: 0 });
  });
});
