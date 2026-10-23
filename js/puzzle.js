/**
 * puzzle.js — 8-Puzzle state representation and utilities.
 *
 * A state is an array of 9 integers read row by row, where 0 is the blank.
 *   2 8 3
 *   1 6 4   ->  [2, 8, 3, 1, 6, 4, 7, 0, 5]
 *   7 _ 5
 *
 * Author: Thanuku Samuel Gullison Kishore Patro (24BCE0867)
 */
(function (global) {
  "use strict";

  const SIZE = 3;
  const N = SIZE * SIZE;

  // Order in which successors are generated (the blank moves in this direction).
  const DIRECTIONS = [
    { name: "Up", dr: -1, dc: 0 },
    { name: "Down", dr: 1, dc: 0 },
    { name: "Left", dr: 0, dc: -1 },
    { name: "Right", dr: 0, dc: 1 },
  ];

  /**
   * Parse user text into a state array.
   * Accepts "283164705", "2 8 3 / 1 6 4 / 7 _ 5", multi-line text, commas, etc.
   * The blank may be written as _, 0, b, x, - or *.
   */
  function parse(input) {
    if (Array.isArray(input)) return validate(input.slice());
    const symbols = String(input).replace(/[\s,;/|]+/g, "").split("");
    const state = symbols.map((c) => (/^[_0bx*\-.]$/i.test(c) ? 0 : Number(c)));
    return validate(state);
  }

  function validate(state) {
    if (state.length !== N || state.some((v) => !Number.isInteger(v))) {
      throw new Error("Enter exactly 9 symbols: the digits 1–8 and one blank (_ or 0).");
    }
    const seen = new Set(state);
    for (let v = 0; v < N; v++) {
      if (!seen.has(v)) {
        throw new Error(
          v === 0
            ? "The puzzle needs exactly one blank (_ or 0)."
            : `Tile ${v} is missing. Each of 1–8 must appear exactly once.`
        );
      }
    }
    return state;
  }

  const toKey = (state) => state.join("");
  const fromKey = (key) => key.split("").map(Number);

  /** Pretty-print as 3 lines with _ for the blank. */
  function format(state) {
    const s = typeof state === "string" ? fromKey(state) : state;
    let out = "";
    for (let r = 0; r < SIZE; r++) {
      out += s.slice(r * SIZE, r * SIZE + SIZE).map((v) => (v === 0 ? "_" : v)).join("");
      if (r < SIZE - 1) out += "\n";
    }
    return out;
  }

  /** Number of inversions, ignoring the blank. */
  function inversions(state) {
    const tiles = state.filter((v) => v !== 0);
    let count = 0;
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) if (tiles[i] > tiles[j]) count++;
    }
    return count;
  }

  /**
   * On a 3x3 board a move never changes inversion parity, so a goal is
   * reachable from a start state iff both have the same parity.
   */
  const isSolvable = (start, goal) => inversions(start) % 2 === inversions(goal) % 2;

  /** Successor function: returns [{ state, move, tile }]. */
  function successors(state) {
    const blank = state.indexOf(0);
    const r = Math.floor(blank / SIZE);
    const c = blank % SIZE;
    const out = [];
    for (const d of DIRECTIONS) {
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
      const target = nr * SIZE + nc;
      const next = state.slice();
      next[blank] = next[target];
      next[target] = 0;
      out.push({ state: next, move: d.name, tile: state[target] });
    }
    return out;
  }

  /* ---------------------------- Heuristics ---------------------------- */

  function goalPositions(goal) {
    const pos = new Array(N);
    goal.forEach((v, i) => (pos[v] = i));
    return pos;
  }

  /** h1: number of tiles (not counting the blank) out of place. */
  function misplacedTiles(state, goalPos) {
    let h = 0;
    for (let i = 0; i < N; i++) if (state[i] !== 0 && goalPos[state[i]] !== i) h++;
    return h;
  }

  /** h2: sum over tiles of |row - goalRow| + |col - goalCol|. */
  function manhattanDistance(state, goalPos) {
    let h = 0;
    for (let i = 0; i < N; i++) {
      const v = state[i];
      if (v === 0) continue;
      const g = goalPos[v];
      h += Math.abs(Math.floor(i / SIZE) - Math.floor(g / SIZE)) + Math.abs((i % SIZE) - (g % SIZE));
    }
    return h;
  }

  const HEURISTICS = {
    misplaced: { label: "Misplaced Tiles (h₁)", fn: misplacedTiles },
    manhattan: { label: "Manhattan Distance (h₂)", fn: manhattanDistance },
  };

  /** Returns h(state) bound to a particular goal. */
  function heuristic(name, goal) {
    const h = HEURISTICS[name];
    if (!h) throw new Error(`Unknown heuristic: ${name}`);
    const pos = goalPositions(goal);
    return (state) => h.fn(state, pos);
  }

  /**
   * Random solvable puzzle: random walk of `moves` steps from the goal,
   * never immediately undoing the previous move.
   */
  function randomSolvable(goal, moves = 25, rng = Math.random) {
    let state = goal.slice();
    let prevBlank = -1;
    for (let i = 0; i < moves; i++) {
      const blank = state.indexOf(0);
      const options = successors(state).filter((s) => s.state.indexOf(0) !== prevBlank);
      const pick = options[Math.floor(rng() * options.length)];
      prevBlank = blank;
      state = pick.state;
    }
    if (toKey(state) === toKey(goal)) return randomSolvable(goal, moves, rng);
    return state;
  }

  const Puzzle = {
    SIZE,
    N,
    DIRECTIONS,
    parse,
    toKey,
    fromKey,
    format,
    inversions,
    isSolvable,
    successors,
    HEURISTICS,
    heuristic,
    misplacedTiles,
    manhattanDistance,
    goalPositions,
    randomSolvable,
  };

  global.Puzzle = Puzzle;
  if (typeof module !== "undefined" && module.exports) module.exports = Puzzle;
})(typeof window !== "undefined" ? window : globalThis);
