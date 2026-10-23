/**
 * algorithms.js — State-space search algorithms for the 8-Puzzle, written from scratch.
 *
 *   Uninformed : BFS, DFS, DLS, IDDLS, UCS
 *   Informed   : Greedy Best First Search (GBFS)  <- assigned algorithm (No. 6)
 *                A* Search
 *
 * Every algorithm returns the same result object. While searching, each node
 * expansion is recorded as a "frame" (the expanded node, its parent, the generated
 * successors and snapshots of the frontier and explored lists) so the UI can replay
 * the search step by step.
 *
 * Author: Thanuku Samuel Gullison Kishore Patro (24BCE0867)
 */
(function (global) {
  "use strict";

  const Puzzle = global.Puzzle || (typeof require !== "undefined" ? require("./puzzle.js") : null);

  // Rough per-node footprint in a JS engine (state string + node object + set/map entry).
  const BYTES_PER_NODE = 160;
  const PREVIEW = 6;

  const DEFAULTS = {
    heuristic: "manhattan",
    depthLimit: 20, // DLS
    maxDepth: 31, // IDDLS upper bound (no 8-puzzle instance needs more than 31 moves)
    maxExpansions: 250000, // safety cap so the browser never freezes
    maxExpansionsDepthLimited: 3000000, // DLS / IDDLS re-expand states, so they get a larger cap
    traceLimit: 3000, // number of expansion frames kept for the visualiser
  };

  const ALGORITHMS = {
    bfs: { name: "Breadth First Search", short: "BFS", type: "Uninformed" },
    dfs: { name: "Depth First Search", short: "DFS", type: "Uninformed" },
    dls: { name: "Depth Limited Search", short: "DLS", type: "Uninformed" },
    iddls: { name: "Iterative Deepening Depth Limited Search", short: "IDDLS", type: "Uninformed" },
    ucs: { name: "Uniform Cost Search", short: "UCS", type: "Uninformed" },
    gbfs: { name: "Greedy Best First Search", short: "GBFS", type: "Informed", assigned: true },
    astar: { name: "A* Search", short: "A*", type: "Informed" },
  };

  const now = () =>
    typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

  /* --------------------------- Data structures --------------------------- */

  /** Binary min-heap used as the priority queue (open list) for UCS, GBFS and A*. */
  class MinHeap {
    constructor(compare) {
      this.items = [];
      this.compare = compare;
    }
    get size() {
      return this.items.length;
    }
    push(item) {
      const a = this.items;
      a.push(item);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (this.compare(a[i], a[p]) >= 0) break;
        [a[i], a[p]] = [a[p], a[i]];
        i = p;
      }
    }
    pop() {
      const a = this.items;
      const top = a[0];
      const last = a.pop();
      if (a.length > 0) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < a.length && this.compare(a[l], a[m]) < 0) m = l;
          if (r < a.length && this.compare(a[r], a[m]) < 0) m = r;
          if (m === i) break;
          [a[i], a[m]] = [a[m], a[i]];
          i = m;
        }
      }
      return top;
    }
    /** Best few items, read from the top levels of the heap (cheap preview). */
    preview(k) {
      return this.items.slice(0, 31).sort(this.compare).slice(0, k);
    }
  }

  /** FIFO queue with O(1) dequeue (BFS). */
  class Queue {
    constructor() {
      this.items = [];
      this.head = 0;
    }
    get size() {
      return this.items.length - this.head;
    }
    push(x) {
      this.items.push(x);
    }
    pop() {
      const x = this.items[this.head++];
      if (this.head > 4096 && this.head * 2 > this.items.length) {
        this.items = this.items.slice(this.head);
        this.head = 0;
      }
      return x;
    }
    preview(k) {
      return this.items.slice(this.head, this.head + k);
    }
  }

  /** LIFO stack (DFS / DLS). */
  class Stack {
    constructor() {
      this.items = [];
    }
    get size() {
      return this.items.length;
    }
    push(x) {
      this.items.push(x);
    }
    pop() {
      return this.items.pop();
    }
    preview(k) {
      return this.items.slice(-k).reverse();
    }
  }

  /* ------------------------------- Helpers ------------------------------- */

  let nodeId = 0;
  function makeNode(state, parent, move, g, h) {
    return {
      id: nodeId++,
      state,
      key: Puzzle.toKey(state),
      parent,
      move,
      g,
      h,
      f: g + h,
      depth: parent ? parent.depth + 1 : 0,
    };
  }

  function extractPath(node) {
    const states = [];
    const moves = [];
    for (let n = node; n; n = n.parent) {
      states.push(n.state);
      if (n.move) moves.push(n.move);
    }
    return { states: states.reverse(), moves: moves.reverse() };
  }

  const brief = (n) => ({ key: n.key, g: n.g, h: n.h, f: n.f, depth: n.depth, move: n.move });

  /** Shared bookkeeping for one search run. */
  class Run {
    constructor(algo, start, goal, opts) {
      this.algo = algo;
      this.opts = opts;
      this.start = start;
      this.goal = goal;
      this.goalKey = Puzzle.toKey(goal);
      this.informed = algo === "gbfs" || algo === "astar";
      this.h = this.informed ? Puzzle.heuristic(opts.heuristic, goal) : () => 0;
      this.generated = 1; // the root counts as generated
      this.expanded = 0;
      this.maxDepth = 0;
      this.peakNodes = 1;
      this.frames = [];
      this.totalFrames = 0;
      this.recentExplored = [];
      this.t0 = now();
    }
    get recording() {
      return this.frames.length < this.opts.traceLimit;
    }
    noteExpanded(node) {
      this.expanded++;
      if (node.depth > this.maxDepth) this.maxDepth = node.depth;
      this.recentExplored.push(node.key);
      if (this.recentExplored.length > PREVIEW) this.recentExplored.shift();
    }
    notePeak(n) {
      if (n > this.peakNodes) this.peakNodes = n;
    }
    record(frame) {
      this.totalFrames++;
      if (this.recording) this.frames.push(frame);
    }
    frame(type, node, successors, frontier, exploredSize, extra) {
      this.record(
        Object.assign(
          {
            type,
            node: brief(node),
            parent: node.parent ? node.parent.key : null,
            successors,
            generated: this.generated,
            expanded: this.expanded,
            frontierSize: frontier.size,
            exploredSize,
            frontierPreview: frontier.preview(PREVIEW).map(brief),
            exploredPreview: this.recentExplored.slice().reverse(),
            maxDepth: this.maxDepth,
          },
          extra || {}
        )
      );
    }
    finish(goalNode, reason) {
      const timeMs = now() - this.t0;
      const path = goalNode ? extractPath(goalNode) : { states: [], moves: [] };
      return {
        algorithm: this.algo,
        label: ALGORITHMS[this.algo].short,
        name: ALGORITHMS[this.algo].name,
        heuristic: this.informed ? this.opts.heuristic : null,
        found: !!goalNode,
        reason: reason || (goalNode ? "Goal state reached" : "Search space exhausted"),
        path: path.states,
        moves: path.moves,
        cost: goalNode ? goalNode.g : null,
        generated: this.generated,
        expanded: this.expanded,
        maxDepth: this.maxDepth,
        timeMs,
        memoryNodes: this.peakNodes,
        memoryKB: (this.peakNodes * BYTES_PER_NODE) / 1024,
        trace: { frames: this.frames, total: this.totalFrames, truncated: this.totalFrames > this.frames.length },
        options: Object.assign({}, this.opts),
      };
    }
  }

  /* ----------------------------- Graph search ---------------------------- */

  /**
   * One graph-search loop shared by BFS, DFS, UCS, GBFS and A*.
   * The algorithms differ only in the frontier discipline:
   *   BFS  -> FIFO queue            DFS  -> LIFO stack
   *   UCS  -> priority on g(n)      GBFS -> priority on h(n)      A* -> priority on f(n) = g(n) + h(n)
   * The goal test happens when a node is selected for expansion.
   */
  function graphSearch(algo, start, goal, opts) {
    const run = new Run(algo, start, goal, opts);
    const tie = (a, b) => a.id - b.id; // FIFO among equal priorities
    let frontier;
    if (algo === "bfs") frontier = new Queue();
    else if (algo === "dfs") frontier = new Stack();
    else if (algo === "ucs") frontier = new MinHeap((a, b) => a.g - b.g || tie(a, b));
    else if (algo === "gbfs") frontier = new MinHeap((a, b) => a.h - b.h || tie(a, b));
    else if (algo === "astar") frontier = new MinHeap((a, b) => a.f - b.f || a.h - b.h || tie(a, b));
    else throw new Error(`Unknown algorithm ${algo}`);

    // UCS and A* may find a cheaper route to a node already in the frontier.
    const allowsReopen = algo === "ucs" || algo === "astar";
    // DFS keeps true LIFO order: a state may sit in the stack more than once and is
    // marked explored only when it is expanded (the most recently pushed copy wins).
    const isDfs = algo === "dfs";

    const root = makeNode(start, null, null, 0, run.h(start));
    frontier.push(root);
    const bestG = new Map([[root.key, 0]]); // nodes ever added to the frontier
    const closed = new Set(); // explored list

    while (frontier.size > 0) {
      const node = frontier.pop();
      if (closed.has(node.key) || (!isDfs && bestG.get(node.key) < node.g)) continue; // stale entry

      if (node.key === run.goalKey) {
        run.frame("goal", node, [], frontier, closed.size);
        return run.finish(node);
      }
      if (run.expanded >= opts.maxExpansions) {
        return run.finish(null, `Stopped after ${opts.maxExpansions.toLocaleString()} expansions (safety limit)`);
      }

      closed.add(node.key);
      run.noteExpanded(node);

      const recording = run.recording;
      const succInfo = [];
      const children = [];
      for (const s of Puzzle.successors(node.state)) {
        run.generated++;
        const key = Puzzle.toKey(s.state);
        const g = node.g + 1;
        let status;
        if (closed.has(key)) status = "explored";
        else if (!isDfs && bestG.has(key) && (!allowsReopen || bestG.get(key) <= g)) status = "in frontier";
        else {
          status = bestG.has(key) ? "updated" : "added";
          const child = makeNode(s.state, node, s.move, g, run.h(s.state));
          bestG.set(key, g);
          children.push(child);
        }
        if (recording) {
          const h = run.h(s.state);
          succInfo.push({ key, move: s.move, g, h, f: g + h, status });
        }
      }
      // DFS: push in reverse so the first generated move is expanded first.
      if (algo === "dfs") children.reverse();
      children.forEach((c) => frontier.push(c));

      run.notePeak(frontier.size + closed.size);
      if (recording) run.frame("expand", node, succInfo, frontier, closed.size);
    }
    return run.finish(null);
  }

  /* -------------------------- Depth-limited search ------------------------ */

  /**
   * Depth-limited DFS. To avoid exponential re-expansion it remembers the shallowest
   * depth at which each state was reached and only re-expands a state if it is reached
   * again at a smaller depth (so the search is still complete within the limit).
   * Returns { goal, cutoff }.
   */
  function depthLimited(run, limit, extra) {
    const root = makeNode(run.start, null, null, 0, 0);
    const stack = new Stack();
    stack.push(root);
    const shallowest = new Map([[root.key, 0]]);
    let cutoff = false;

    while (stack.size > 0) {
      const node = stack.pop();
      if (shallowest.get(node.key) < node.depth) continue;

      if (node.key === run.goalKey) {
        run.frame("goal", node, [], stack, shallowest.size, extra);
        return { goal: node, cutoff };
      }
      if (node.depth >= limit) {
        cutoff = true; // could go deeper, but not allowed to
        continue;
      }
      if (run.expanded >= run.opts.maxExpansions) return { goal: null, cutoff: true, aborted: true };

      run.noteExpanded(node);
      const recording = run.recording;
      const succInfo = [];
      const children = [];
      for (const s of Puzzle.successors(node.state)) {
        run.generated++;
        const key = Puzzle.toKey(s.state);
        const d = node.depth + 1;
        let status;
        if (shallowest.has(key) && shallowest.get(key) <= d) status = "visited";
        else {
          status = "added";
          shallowest.set(key, d);
          children.push(makeNode(s.state, node, s.move, d, 0));
        }
        if (recording) succInfo.push({ key, move: s.move, g: d, h: 0, f: d, status });
      }
      children.reverse().forEach((c) => stack.push(c));
      run.notePeak(stack.size + shallowest.size);
      if (recording) run.frame("expand", node, succInfo, stack, shallowest.size, extra);
    }
    return { goal: null, cutoff };
  }

  function dls(start, goal, opts) {
    const run = new Run("dls", start, goal, opts);
    const limit = opts.depthLimit;
    const r = depthLimited(run, limit, { limit });
    if (r.goal) return run.finish(r.goal);
    if (r.aborted) return run.finish(null, `Stopped after ${opts.maxExpansions.toLocaleString()} expansions (safety limit)`);
    return run.finish(null, r.cutoff ? `No solution within depth limit ${limit} (cutoff)` : "Search space exhausted");
  }

  function iddls(start, goal, opts) {
    const run = new Run("iddls", start, goal, opts);
    for (let limit = 0; limit <= opts.maxDepth; limit++) {
      const r = depthLimited(run, limit, { limit });
      if (r.goal) {
        const res = run.finish(r.goal);
        res.finalLimit = limit;
        return res;
      }
      if (r.aborted) return run.finish(null, `Stopped after ${opts.maxExpansions.toLocaleString()} expansions (safety limit)`);
      if (!r.cutoff) return run.finish(null, "Search space exhausted");
    }
    return run.finish(null, `No solution up to depth ${opts.maxDepth}`);
  }

  /* --------------------------------- API --------------------------------- */

  function solve(algo, start, goal, options) {
    const opts = Object.assign({}, DEFAULTS, options || {});
    if (!ALGORITHMS[algo]) throw new Error(`Unknown algorithm ${algo}`);
    if (!Puzzle.isSolvable(start, goal)) {
      return {
        algorithm: algo,
        label: ALGORITHMS[algo].short,
        name: ALGORITHMS[algo].name,
        heuristic: algo === "gbfs" || algo === "astar" ? opts.heuristic : null,
        found: false,
        unsolvable: true,
        reason: "Unsolvable: start and goal have different inversion parity",
        path: [],
        moves: [],
        cost: null,
        generated: 0,
        expanded: 0,
        maxDepth: 0,
        timeMs: 0,
        memoryNodes: 0,
        memoryKB: 0,
        trace: { frames: [], total: 0, truncated: false },
        options: opts,
      };
    }
    if (algo === "dls" || algo === "iddls") {
      if (!(options && options.maxExpansions)) opts.maxExpansions = opts.maxExpansionsDepthLimited;
      return algo === "dls" ? dls(start, goal, opts) : iddls(start, goal, opts);
    }
    return graphSearch(algo, start, goal, opts);
  }

  const Search = { ALGORITHMS, DEFAULTS, BYTES_PER_NODE, solve, MinHeap, Queue, Stack };
  global.Search = Search;
  if (typeof module !== "undefined" && module.exports) module.exports = Search;
})(typeof window !== "undefined" ? window : globalThis);
