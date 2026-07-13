export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

const HISTORY_LIMIT = 100;

export function createHistory<T>(initial: T): HistoryState<T> {
  return { past: [], present: initial, future: [] };
}

export function commitHistory<T>(history: HistoryState<T>, next: T): HistoryState<T> {
  if (Object.is(history.present, next)) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

export function commitTransaction<T>(history: HistoryState<T>, baseline: T): HistoryState<T> {
  if (Object.is(baseline, history.present)) return history;
  return commitHistory({ ...history, present: baseline }, history.present);
}

export function undoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: history.future.slice(1),
  };
}

export function resetHistory<T>(_history: HistoryState<T>, initial: T): HistoryState<T> {
  return createHistory(initial);
}
