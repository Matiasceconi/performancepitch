// Historial de deshacer/rehacer local (no se persiste en Base44).
// Mantiene snapshots del array de elementos.

const MAX_HISTORY = 60;

export function createHistory(initial = []) {
  let past = [];
  let present = initial;
  let future = [];

  return {
    get() {
      return present;
    },
    set(elements) {
      present = elements;
    },
    push(elements) {
      past.push(present);
      if (past.length > MAX_HISTORY) past.shift();
      present = elements;
      future = [];
    },
    canUndo() {
      return past.length > 0;
    },
    canRedo() {
      return future.length > 0;
    },
    undo() {
      if (!past.length) return present;
      future.push(present);
      present = past.pop();
      return present;
    },
    redo() {
      if (!future.length) return present;
      past.push(present);
      present = future.pop();
      return present;
    },
    reset(elements) {
      past = [];
      present = elements;
      future = [];
    },
  };
}