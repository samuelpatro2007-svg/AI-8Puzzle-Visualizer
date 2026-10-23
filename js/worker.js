/* worker.js — runs searches off the main thread so the page stays responsive. */
/* global importScripts, Search */
importScripts("puzzle.js", "algorithms.js");

self.onmessage = (e) => {
  const { id, algo, start, goal, options } = e.data;
  try {
    const result = Search.solve(algo, start, goal, options);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
