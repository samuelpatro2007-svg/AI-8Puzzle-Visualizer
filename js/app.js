/**
 * app.js — UI controller: routing, animated boards, search playback,
 * solution summary, comparison page and algorithm information page.
 *
 * Author: Thanuku Samuel Gullison Kishore Patro (24BCE0867)
 */
/* global Puzzle, Search, ALGORITHM_INFO, HEURISTIC_INFO, bootstrap */
(function () {
  "use strict";

  /* ============================== Utilities ============================== */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fmt = (n) => (n === null || n === undefined || n === "" ? "–" : Number(n).toLocaleString("en-US"));
  const fmtTime = (ms) => (ms < 1 ? `${ms.toFixed(2)} ms` : ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(2)} s`);
  const fmtMem = (kb) => (kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`);
  const memLevel = (kb) => (kb < 100 ? "Low" : kb < 2048 ? "Medium" : "High");
  const ARROWS = { Up: "↑", Down: "↓", Left: "←", Right: "→" };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function safeStorage(op, key, value) {
    try {
      if (op === "get") return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {
      /* storage unavailable (private mode etc.) — ignore */
    }
    return null;
  }

  /** Mini (static) board as an HTML string. `hl` = index to outline. */
  function mini(key, goalKey, cls = "", hl = -1) {
    let h = `<div class="mini ${cls}">`;
    for (let i = 0; i < 9; i++) {
      const c = key[i];
      const extra = i === hl ? " hl" : "";
      if (c === "0") h += `<span class="b${extra}"></span>`;
      else h += `<span class="${goalKey && goalKey[i] === c ? "ok" : ""}${extra}">${c}</span>`;
    }
    return h + "</div>";
  }

  /* ========================= Background search runner ========================= */
  /**
   * Runs Search.solve in a Web Worker so long searches (e.g. IDDLS on a 31-move
   * puzzle) never freeze the page. Falls back to the main thread when workers are
   * unavailable (for example when index.html is opened directly from disk).
   */
  function createRunner() {
    let worker = null;
    let broken = false;
    let seq = 0;
    const pending = new Map();

    const inline = (job) =>
      setTimeout(() => {
        try {
          job.resolve(Search.solve(job.algo, job.start, job.goal, job.options));
        } catch (e) {
          job.reject(e);
        }
      }, 30);

    function create() {
      try {
        worker = new Worker("js/worker.js");
        worker.onmessage = (e) => {
          const job = pending.get(e.data.id);
          if (!job) return;
          pending.delete(e.data.id);
          if (e.data.error) job.reject(new Error(e.data.error));
          else job.resolve(e.data.result);
        };
        worker.onerror = (ev) => {
          if (ev && ev.preventDefault) ev.preventDefault();
          broken = true;
          worker = null;
          const jobs = Array.from(pending.values());
          pending.clear();
          jobs.forEach(inline);
        };
      } catch (e) {
        broken = true;
        worker = null;
      }
    }

    return {
      solve(algo, start, goal, options) {
        return new Promise((resolve, reject) => {
          const job = { algo, start, goal, options, resolve, reject };
          if (!worker && !broken) create();
          if (!worker) return inline(job);
          const id = ++seq;
          pending.set(id, job);
          worker.postMessage({ id, algo, start, goal, options });
        });
      },
      cancel() {
        if (worker) {
          worker.terminate();
          worker = null;
        }
        pending.forEach((job) => job.reject(new Error("cancelled")));
        pending.clear();
      },
    };
  }

  /* ============================ Animated board ============================ */
  class Board {
    constructor(el) {
      this.el = el;
      el.innerHTML = "";
      this.blank = document.createElement("div");
      this.blank.className = "blank-slot";
      el.appendChild(this.blank);
      this.tiles = {};
      for (let v = 1; v <= 8; v++) {
        const t = document.createElement("div");
        t.className = "tile";
        t.textContent = v;
        el.appendChild(t);
        this.tiles[v] = t;
      }
      this.state = null;
    }
    set(state, goal) {
      const prev = this.state;
      state.forEach((v, i) => {
        const node = v === 0 ? this.blank : this.tiles[v];
        node.style.setProperty("--r", Math.floor(i / 3));
        node.style.setProperty("--c", i % 3);
        if (v) {
          node.classList.toggle("in-place", !!goal && goal[i] === v);
          const moved = prev && prev.indexOf(v) !== i;
          node.classList.toggle("moved", !!moved);
        }
      });
      this.state = state.slice();
      this.el.classList.toggle("goal-reached", !!goal && Puzzle.toKey(state) === Puzzle.toKey(goal));
    }
    setDuration(ms) {
      this.el.style.setProperty("--dur", `${ms}ms`);
    }
  }

  /* ================================ Router ================================ */
  const PAGES = ["home", "solver", "compare", "algorithms"];
  let currentPage = "home";

  function route() {
    const want = location.hash.replace("#", "") || "home";
    const page = PAGES.includes(want) ? want : "home";
    currentPage = page;
    PAGES.forEach((p) => ($(`#page-${p}`).hidden = p !== page));
    $$(".app-nav .nav-link").forEach((a) => a.classList.toggle("active", a.dataset.page === page));
    const nav = $("#nav");
    if (nav.classList.contains("show") && window.bootstrap) bootstrap.Collapse.getOrCreateInstance(nav).hide();
    window.scrollTo({ top: 0 });
    if (page === "compare") Compare.onShow();
    Demo.toggle(page === "home");
  }

  /* ================================ Theme ================================ */
  $("#themeToggle").addEventListener("click", () => {
    const html = document.documentElement;
    const next = html.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-bs-theme", next);
    safeStorage("set", "puzzle-theme", next);
  });

  /* ================================ Home demo ================================ */
  const Demo = (() => {
    const start = Puzzle.parse("283164705");
    const goal = Puzzle.parse("123804765");
    const board = new Board($("#demoBoard"));
    board.setDuration(380);
    const res = Search.solve("gbfs", start, goal, { heuristic: "manhattan", traceLimit: 0 });
    let i = 0;
    let timer = null;
    board.set(start, goal);
    function step() {
      i = (i + 1) % (res.path.length + 2); // two "rest" beats on the goal
      const j = Math.min(i, res.path.length - 1);
      board.set(res.path[j], goal);
      $("#demoStep").textContent = j === 0 ? "Step 0 · start" : `Step ${j} · blank ${res.moves[j - 1]}`;
      timer = setTimeout(step, j === res.path.length - 1 ? 1400 : 900);
    }
    return {
      toggle(on) {
        clearTimeout(timer);
        if (on) timer = setTimeout(step, 900);
      },
    };
  })();

  /* ================================ Solver ================================ */
  const SPEED_DELAYS = [1400, 1000, 750, 550, 400, 280, 180, 110, 60, 25];
  const ALGO_NOTES = {
    gbfs: "f(n) = h(n). Always expands the node that looks closest to the goal. Very fast, but the path is not guaranteed to be the shortest.",
    astar: "f(n) = g(n) + h(n). Balances cost so far with estimated cost to go. Optimal with an admissible heuristic.",
    bfs: "FIFO queue. Expands level by level; optimal for unit move costs but memory-hungry.",
    dfs: "LIFO stack. Follows one branch as deep as possible. Expect a very long, non-optimal path.",
    dls: "DFS that never expands nodes deeper than the limit l. Fails if the solution needs more than l moves.",
    iddls: "Runs DLS with l = 0, 1, 2, … until the goal is found. Optimal; deep puzzles can take several seconds.",
    ucs: "Priority queue on g(n). With unit move costs it behaves like BFS.",
  };

  const Solver = (() => {
    const el = {
      start: $("#startInput"),
      goal: $("#goalInput"),
      preset: $("#presetSelect"),
      algo: $("#algoSelect"),
      depth: $("#depthLimit"),
      maxDepth: $("#maxDepth"),
      error: $("#inputError"),
      run: $("#runBtn"),
      pause: $("#pauseBtn"),
      resume: $("#resumeBtn"),
      prev: $("#prevBtn"),
      next: $("#nextBtn"),
      skip: $("#skipBtn"),
      reset: $("#resetBtn"),
      speed: $("#speed"),
      speedLabel: $("#speedLabel"),
      progress: $("#progressBar"),
      progressText: $("#progressText"),
      phase: $("#phaseBadge"),
    };
    const startBoard = new Board($("#startBoard"));
    const goalBoard = new Board($("#goalBoard"));
    const current = new Board($("#currentBoard"));
    const runner = createRunner();

    const st = {
      start: null,
      goal: null,
      result: null,
      T: 0, // number of trace frames
      total: 0, // trace frames + solution steps
      idx: -1,
      playing: false,
      solving: false,
      timer: null,
      token: 0,
      optimal: null,
      summaryShown: false,
      lastProcessIdx: null,
    };

    const heuristic = () => ($('input[name="heuristic"]:checked') || {}).value || "manhattan";
    const delay = () => SPEED_DELAYS[Number(el.speed.value) - 1];

    function showError(msg) {
      el.error.hidden = !msg;
      el.error.textContent = msg || "";
    }

    function readInputs(quiet) {
      try {
        const s = Puzzle.parse(el.start.value);
        const g = Puzzle.parse(el.goal.value);
        st.start = s;
        st.goal = g;
        startBoard.set(s, g);
        goalBoard.set(g, g);
        if (!st.result) current.set(s, g);
        showError(Puzzle.isSolvable(s, g) ? "" : "This puzzle is unsolvable: the initial and goal states have different inversion parity, so no sequence of moves connects them.");
        return true;
      } catch (e) {
        showError(e.message);
        return false;
      }
    }

    function updateAlgoUI() {
      const a = el.algo.value;
      $("#heuristicGroup").hidden = !(a === "gbfs" || a === "astar");
      $("#depthGroup").hidden = a !== "dls";
      $("#maxDepthGroup").hidden = a !== "iddls";
      $("#algoNote").textContent = ALGO_NOTES[a];
      $$(".stat-h").forEach((s) => s.classList.toggle("dim", !(a === "gbfs" || a === "astar")));
    }

    function updateButtons() {
      const has = !!st.result && !st.result.unsolvable && st.total > 0;
      const atEnd = has && st.idx >= st.total - 1;
      el.run.disabled = st.solving;
      el.run.innerHTML = st.solving
        ? '<span class="spinner-border spinner-border-sm me-1"></span> Searching…'
        : `<span class="ico">▶</span> ${st.result ? "Run again" : "Run"}`;
      el.pause.disabled = !st.playing;
      el.resume.disabled = !has || st.playing || atEnd;
      el.prev.disabled = !has || st.idx < 0;
      el.next.disabled = !has || atEnd;
      el.skip.disabled = !has || !st.result.found || st.idx >= st.T;
    }

    function setPhase(text, kind) {
      el.phase.textContent = text;
      el.phase.className = `pill pill-${kind} ms-1`;
    }

    function stopPlay() {
      st.playing = false;
      clearTimeout(st.timer);
    }

    function clearProcess() {
      $("#curNodeMini").innerHTML = "—";
      $("#parentMini").innerHTML = "—";
      ["sGenerated", "sExpanded", "sFrontier", "sExplored"].forEach((id) => ($("#" + id).textContent = "0"));
      ["sDepth", "sCost", "sH", "sF"].forEach((id) => ($("#" + id).textContent = "–"));
      $("#fExplain").innerHTML = "";
      $("#successors").innerHTML = '<p class="empty">Successors of the expanded node will appear here.</p>';
      $("#frontierList").innerHTML = '<p class="empty">—</p>';
      $("#exploredList").innerHTML = '<p class="empty">—</p>';
      $("#frontierOrder").textContent = "";
      $("#traceNote").textContent = "";
      st.lastProcessIdx = null;
    }

    function reset(keepInputs = true) {
      st.token++;
      if (st.solving) runner.cancel();
      stopPlay();
      Object.assign(st, { result: null, T: 0, total: 0, idx: -1, solving: false, optimal: null, summaryShown: false });
      clearProcess();
      $("#summaryPanel").hidden = true;
      $("#pathPanel").hidden = true;
      el.progress.style.width = "0%";
      el.progress.classList.remove("solution");
      el.progressText.textContent = "Press Run to start the search.";
      setPhase("Ready", "muted");
      if (keepInputs) readInputs(true);
      updateButtons();
    }

    async function run() {
      if (!readInputs()) return;
      reset();
      const token = st.token;
      const algo = el.algo.value;
      const options = {
        heuristic: heuristic(),
        depthLimit: Math.max(0, parseInt(el.depth.value, 10) || 0),
        maxDepth: Math.max(1, parseInt(el.maxDepth.value, 10) || 31),
      };
      st.solving = true;
      setPhase("Searching…", "accent");
      el.progressText.textContent = `Running ${Search.ALGORITHMS[algo].name}…`;
      updateButtons();
      try {
        const res = await runner.solve(algo, st.start, st.goal, options);
        if (token !== st.token) return;
        st.solving = false;
        st.result = res;
        if (res.unsolvable) {
          setPhase("Unsolvable", "bad");
          el.progressText.textContent = res.reason;
          renderSummary();
          updateButtons();
          return;
        }
        st.T = res.trace.frames.length;
        st.total = st.T + res.path.length;
        st.idx = -1;
        $("#traceNote").textContent = res.trace.truncated
          ? `Showing the first ${fmt(st.T)} of ${fmt(res.trace.total)} expansions. Totals in the summary are exact.`
          : "";
        renderPath();
        play();
        if (res.found && ["gbfs", "dfs", "dls"].includes(algo)) {
          runner.solve("astar", st.start, st.goal, { heuristic: "manhattan", traceLimit: 0 }).then((r) => {
            if (token !== st.token) return;
            st.optimal = r.moves.length;
            if (st.summaryShown) renderSummary();
          }, () => {});
        }
      } catch (e) {
        if (token !== st.token) return;
        st.solving = false;
        showError(e.message);
        setPhase("Error", "bad");
        updateButtons();
      }
    }

    function play() {
      if (!st.result || st.idx >= st.total - 1) return;
      st.playing = true;
      updateButtons();
      tick();
    }

    function tick() {
      clearTimeout(st.timer);
      if (!st.playing) return;
      if (st.idx >= st.total - 1) {
        st.playing = false;
        updateButtons();
        return;
      }
      go(st.idx + 1);
      const inSolution = st.idx >= st.T;
      st.timer = setTimeout(tick, inSolution ? Math.max(delay(), 260) : delay());
    }

    function go(i) {
      if (!st.result) return;
      st.idx = Math.max(-1, Math.min(st.total - 1, i));
      render();
    }

    function manualStep(delta) {
      stopPlay();
      go(st.idx + delta);
    }

    function render() {
      const r = st.result;
      const d = delay();
      current.setDuration(Math.min(320, Math.max(60, d * 0.75)));
      el.progress.style.width = st.total ? `${((st.idx + 1) / st.total) * 100}%` : "0%";
      if (st.idx < 0) {
        current.set(st.start, st.goal);
        clearProcess();
        setPhase("Ready", "muted");
        el.progressText.textContent = "At the initial state. Press Next or Resume.";
        el.progress.classList.remove("solution");
        highlightPath(-1);
      } else if (st.idx < st.T) {
        const fr = r.trace.frames[st.idx];
        current.set(Puzzle.fromKey(fr.node.key), st.goal);
        renderProcess(st.idx);
        el.progress.classList.remove("solution");
        highlightPath(-1);
        const limit = fr.limit !== undefined ? ` · depth limit ${fr.limit}` : "";
        if (fr.type === "goal") {
          setPhase("Goal reached", "ok");
          el.progressText.textContent = `Goal state selected after ${fmt(fr.expanded)} expansions${limit}. Next: replay the solution path.`;
        } else {
          setPhase(`Expanding #${fmt(fr.expanded)}`, "accent");
          el.progressText.textContent = `Search frame ${fmt(st.idx + 1)} of ${fmt(st.T)}${limit}`;
        }
      } else {
        const j = st.idx - st.T;
        if (st.lastProcessIdx !== st.T - 1 && st.T > 0) renderProcess(st.T - 1);
        current.set(r.path[j], st.goal);
        el.progress.classList.add("solution");
        setPhase(`Solution ${j}/${r.moves.length}`, "ok");
        el.progressText.textContent =
          j === 0
            ? `Solution path · step 0 of ${fmt(r.moves.length)} (initial state)`
            : `Solution path · step ${fmt(j)} of ${fmt(r.moves.length)} · blank moved ${r.moves[j - 1]} ${ARROWS[r.moves[j - 1]]}`;
        highlightPath(j);
      }
      if (st.T > 0 && st.idx >= st.T - 1 && !st.summaryShown) {
        renderSummary();
      }
      updateButtons();
    }

    /* ---------------- Search process panel ---------------- */
    function renderProcess(i) {
      st.lastProcessIdx = i;
      const r = st.result;
      const fr = r.trace.frames[i];
      const gk = Puzzle.toKey(st.goal);
      const algo = r.algorithm;
      const informed = algo === "gbfs" || algo === "astar";
      const n = fr.node;

      $("#curNodeMini").innerHTML = `${mini(n.key, gk, "mini-lg")}<div class="hint m-0 mono">depth ${n.depth}${n.move ? ` · via ${n.move}` : " · root"}</div>`;
      $("#parentMini").innerHTML = fr.parent ? mini(fr.parent, gk, "mini-lg") : '<span class="hint m-0">Root — no parent</span>';
      $("#sGenerated").textContent = fmt(fr.generated);
      $("#sExpanded").textContent = fmt(fr.expanded);
      $("#sFrontier").textContent = fmt(fr.frontierSize);
      $("#sExplored").textContent = fmt(fr.exploredSize);
      $("#sDepth").textContent = n.depth;
      $("#sCost").textContent = n.g;
      $("#sH").textContent = informed ? n.h : "–";
      $("#sF").textContent = informed ? n.f - (algo === "gbfs" ? n.g : 0) : "–";

      const lim = fr.limit !== undefined ? fr.limit : "";
      const explain = {
        gbfs: `GBFS orders the open list by <b>f(n) = h(n) = ${n.h}</b>. g(n) = ${n.g} is recorded for the path but not used to choose nodes.`,
        astar: `A* orders the open list by <b>f(n) = g(n) + h(n) = ${n.g} + ${n.h} = ${n.f}</b>.`,
        ucs: `UCS orders the open list by <b>g(n) = ${n.g}</b>.`,
        bfs: "BFS takes the <b>oldest</b> node from a FIFO queue, so shallow nodes come first.",
        dfs: "DFS takes the <b>newest</b> node from a LIFO stack, so it dives deeper first.",
        dls: `DLS is DFS that does not expand nodes at depth <b>l = ${lim}</b>.`,
        iddls: `IDDLS is running DLS with depth limit <b>l = ${lim}</b>. It raises l by 1 after each failed pass.`,
      }[algo];
      $("#fExplain").innerHTML = explain;

      // Successors
      const succ = fr.successors;
      if (fr.type === "goal") {
        $("#successors").innerHTML = '<p class="empty">Goal test passed when this node was selected, so it is not expanded.</p>';
      } else if (!succ.length) {
        $("#successors").innerHTML = '<p class="empty">No successors.</p>';
      } else {
        let best = null;
        if (informed) {
          const key = algo === "gbfs" ? "h" : "f";
          succ.filter((s) => s.status === "added" || s.status === "updated").forEach((s) => {
            if (!best || s[key] < best[key]) best = s;
          });
        }
        $("#successors").innerHTML = succ
          .map((s) => {
            const metric = informed
              ? algo === "gbfs"
                ? `h=<b>${s.h}</b> g=${s.g}`
                : `g=${s.g} h=${s.h} f=<b>${s.f}</b>`
              : `g=${s.g}`;
            const isBest = best && s.key === best.key;
            return `<div class="mini-item${isBest ? " best" : ""}">
              ${mini(s.key, gk, "", s.key.indexOf("0") /* new blank position */)}
              <div class="meta">blank ${s.move} ${ARROWS[s.move]}<br>${metric}</div>
              <span class="status status-${s.status.replace(" ", "-")}">${isBest ? "lowest " + (algo === "gbfs" ? "h" : "f") : s.status}</span>
            </div>`;
          })
          .join("");
      }

      // Frontier & explored previews
      const orderHint = {
        gbfs: "(lowest h first)",
        astar: "(lowest f first)",
        ucs: "(lowest g first)",
        bfs: "(next to dequeue first)",
        dfs: "(top of stack first)",
        dls: "(top of stack first)",
        iddls: "(top of stack first)",
      }[algo];
      $("#frontierOrder").textContent = `${orderHint} · ${fmt(fr.frontierSize)} nodes`;
      $("#frontierList").innerHTML = fr.frontierPreview.length
        ? fr.frontierPreview
            .map((f) => {
              const m = algo === "gbfs" ? `h=${f.h}` : algo === "astar" ? `f=${f.f}` : algo === "ucs" ? `g=${f.g}` : `d=${f.depth}`;
              return `<div class="mini-item">${mini(f.key, gk)}<div class="meta">${m}</div></div>`;
            })
            .join("") + (fr.frontierSize > fr.frontierPreview.length ? `<div class="hint align-self-center">+${fmt(fr.frontierSize - fr.frontierPreview.length)} more</div>` : "")
        : '<p class="empty">Empty</p>';
      $("#exploredList").innerHTML = fr.exploredPreview.length
        ? fr.exploredPreview.map((k) => `<div class="mini-item">${mini(k, gk)}</div>`).join("") +
          (fr.exploredSize > fr.exploredPreview.length ? `<div class="hint align-self-center">+${fmt(fr.exploredSize - fr.exploredPreview.length)} more</div>` : "")
        : '<p class="empty">Empty</p>';
    }

    /* ---------------- Solution path ---------------- */
    const PATH_RENDER_LIMIT = 400;
    function renderPath() {
      const r = st.result;
      const panel = $("#pathPanel");
      if (!r.found) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      const gk = Puzzle.toKey(st.goal);
      const n = r.path.length;
      const indices = n <= PATH_RENDER_LIMIT ? [...Array(n).keys()] : [...Array(200).keys(), -1, ...Array.from({ length: 100 }, (_, k) => n - 100 + k)];
      let html = "";
      indices.forEach((j, pos) => {
        if (j === -1) {
          html += `<div class="path-gap">… ${fmt(n - 300)} steps not drawn …</div>`;
          return;
        }
        if (pos > 0 && indices[pos - 1] !== -1) {
          const mv = r.moves[j - 1];
          html += `<div class="path-arrow"><span class="a">${ARROWS[mv]}</span>${mv}</div>`;
        }
        const key = Puzzle.toKey(r.path[j]);
        html += `<div class="path-step" data-j="${j}"><span class="lbl">Step ${j}</span>${mini(key, gk)}</div>`;
      });
      $("#solutionPath").innerHTML = html;
      const movesStr = r.moves.length ? r.moves.slice(0, 400).join(" → ") + (r.moves.length > 400 ? " → …" : "") : "Already at the goal — no moves needed.";
      $("#movesString").textContent = `Blank moves: ${movesStr}`;
      $("#pathNote").textContent = `${fmt(r.moves.length)} moves · click any step to jump to it`;
    }

    function highlightPath(j) {
      $$(".path-step.current").forEach((e) => e.classList.remove("current"));
      if (j >= 0) {
        const e = $(`.path-step[data-j="${j}"]`);
        if (e) e.classList.add("current");
      }
    }

    /* ---------------- Summary ---------------- */
    function renderSummary() {
      st.summaryShown = true;
      const r = st.result;
      const panel = $("#summaryPanel");
      panel.hidden = false;
      const hName = r.heuristic ? Puzzle.HEURISTICS[r.heuristic].label : null;
      const algoLabel = `${r.name}${hName ? ` · ${hName}` : ""}${r.algorithm === "dls" ? ` · l = ${r.options.depthLimit}` : ""}`;
      const cells = [
        ["Total moves", r.found ? fmt(r.moves.length) : "–"],
        ["Path cost", r.found ? fmt(r.cost) : "–"],
        ["Nodes generated", fmt(r.generated)],
        ["Nodes expanded", fmt(r.expanded)],
        ["Max search depth", fmt(r.maxDepth)],
        ["Execution time", fmtTime(r.timeMs)],
        ["Memory (approx.)", `${fmtMem(r.memoryKB)}`],
        ["Peak nodes stored", fmt(r.memoryNodes)],
      ];
      let callout = "";
      if (r.unsolvable) {
        callout = `<div class="callout">Inversions: initial = ${Puzzle.inversions(st.start)}, goal = ${Puzzle.inversions(st.goal)}. On a 3 × 3 board every move keeps the inversion parity, so states with different parity can never reach each other.</div>`;
      } else if (r.found && st.optimal !== null && ["gbfs", "dfs", "dls"].includes(r.algorithm)) {
        const extra = r.moves.length - st.optimal;
        callout =
          extra === 0
            ? `<div class="callout info">This ${r.label} solution is <b>optimal</b>: A* confirms the shortest solution has ${st.optimal} moves. ${r.algorithm === "gbfs" ? "GBFS is not guaranteed to do this; it happened because h(n) led it straight to the goal." : ""}</div>`
            : `<div class="callout">The shortest possible solution has <b>${fmt(st.optimal)} moves</b> (checked with A*), so this path is <b>${fmt(extra)} moves longer</b>. ${r.algorithm === "gbfs" ? "GBFS ranks nodes only by h(n) and ignores the cost already spent, g(n), so it can follow a detour that looks promising." : ""}</div>`;
      } else if (r.found && r.algorithm === "iddls") {
        callout = `<div class="callout info">IDDLS found the goal on the pass with depth limit l = ${r.finalLimit}, which is the optimal number of moves.</div>`;
      } else if (!r.found && r.algorithm === "dls") {
        callout = `<div class="callout">DLS stops at depth l = ${r.options.depthLimit}. If the solution needs more moves than that, DLS cannot find it. Raise the limit or use IDDLS.</div>`;
      }
      $("#summary").innerHTML = `
        <div class="summary-head">
          <span class="result ${r.found ? "ok" : "bad"}">${r.found ? "✓ Solution Found" : "✗ Solution Not Found"}</span>
          <span class="pill ${r.algorithm === "gbfs" ? "pill-gbfs" : "pill-accent"}">${esc(algoLabel)}</span>
          ${r.found ? "" : `<span class="hint m-0">${esc(r.reason)}</span>`}
        </div>
        <div class="summary-grid">${cells.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join("")}</div>
        ${callout}
        <p class="hint mb-0 mt-3">Execution time is the search itself, measured with performance.now(), including the step recording used for the visualisation. Memory is estimated from the peak number of nodes held in the frontier and explored lists (≈ ${Search.BYTES_PER_NODE} bytes each).</p>`;
    }

    /* ---------------- Events ---------------- */
    function onInputEdited() {
      el.preset.value = "";
      reset();
    }
    el.start.addEventListener("input", onInputEdited);
    el.goal.addEventListener("input", onInputEdited);
    el.preset.addEventListener("change", () => {
      if (!el.preset.value) return;
      const [s, g] = el.preset.value.split("|");
      el.start.value = Puzzle.format(Puzzle.fromKey(s));
      el.goal.value = Puzzle.format(Puzzle.fromKey(g));
      reset();
    });
    $("#randomBtn").addEventListener("click", () => {
      let goal;
      try {
        goal = Puzzle.parse(el.goal.value);
      } catch (e) {
        goal = Puzzle.parse("123804765");
        el.goal.value = Puzzle.format(goal);
      }
      const shuffle = Number($("#difficulty").value);
      el.start.value = Puzzle.format(Puzzle.randomSolvable(goal, shuffle));
      el.preset.value = "";
      reset();
    });
    el.algo.addEventListener("change", () => {
      updateAlgoUI();
      reset();
    });
    $$('input[name="heuristic"]').forEach((r) => r.addEventListener("change", () => reset()));
    el.depth.addEventListener("change", () => reset());
    el.maxDepth.addEventListener("change", () => reset());

    el.run.addEventListener("click", run);
    el.pause.addEventListener("click", () => {
      stopPlay();
      updateButtons();
    });
    el.resume.addEventListener("click", play);
    el.next.addEventListener("click", () => manualStep(1));
    el.prev.addEventListener("click", () => manualStep(-1));
    el.skip.addEventListener("click", () => {
      stopPlay();
      go(st.T);
    });
    el.reset.addEventListener("click", () => reset());
    el.speed.addEventListener("input", () => {
      el.speedLabel.textContent = `${el.speed.value}×`;
    });
    $("#solutionPath").addEventListener("click", (e) => {
      const step = e.target.closest(".path-step");
      if (!step || !st.result) return;
      stopPlay();
      go(st.T + Number(step.dataset.j));
    });
    document.addEventListener("keydown", (e) => {
      if (currentPage !== "solver" || !st.result) return;
      if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(document.activeElement.tagName) && e.key === " ") return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (e.key === "ArrowRight") manualStep(1);
      else if (e.key === "ArrowLeft") manualStep(-1);
      else if (e.key === " ") {
        e.preventDefault();
        if (st.playing) {
          stopPlay();
          updateButtons();
        } else play();
      }
    });

    updateAlgoUI();
    readInputs(true);
    updateButtons();
    return { inputs: () => ({ start: el.start.value, goal: el.goal.value }) };
  })();

  /* ============================== Comparison ============================== */
  const Compare = (() => {
    const ROWS = [
      { algo: "bfs" },
      { algo: "dfs" },
      { algo: "dls" },
      { algo: "iddls" },
      { algo: "ucs" },
      { algo: "gbfs", h: "misplaced" },
      { algo: "gbfs", h: "manhattan" },
      { algo: "astar", h: "misplaced" },
      { algo: "astar", h: "manhattan" },
    ];
    const H_SHORT = { misplaced: "h₁ misplaced", manhattan: "h₂ Manhattan" };
    const runner = createRunner();
    const startEl = $("#cmpStart");
    const goalEl = $("#cmpGoal");
    let touched = false;
    let running = false;
    let ranFor = null;
    let token = 0;

    const rowLabel = (row) => `${Search.ALGORITHMS[row.algo].short}${row.h ? ` <small>${H_SHORT[row.h]}</small>` : ""}`;
    const rowText = (row) => `${Search.ALGORITHMS[row.algo].short}${row.h ? ` (${row.h === "manhattan" ? "Manhattan" : "Misplaced"})` : ""}`;

    function showError(msg) {
      $("#cmpError").hidden = !msg;
      $("#cmpError").textContent = msg || "";
    }

    function onShow() {
      if (!touched) {
        const s = Solver.inputs();
        startEl.value = s.start;
        goalEl.value = s.goal;
      }
      const key = startEl.value + "|" + goalEl.value;
      if (!running && ranFor !== key) run();
    }

    async function run() {
      let start, goal;
      try {
        start = Puzzle.parse(startEl.value);
        goal = Puzzle.parse(goalEl.value);
      } catch (e) {
        showError(e.message);
        return;
      }
      if (!Puzzle.isSolvable(start, goal)) {
        showError("This puzzle is unsolvable (different inversion parity), so there is nothing to compare.");
        return;
      }
      showError("");
      ranFor = startEl.value + "|" + goalEl.value;
      const my = ++token;
      running = true;
      $("#cmpRun").disabled = true;
      $("#cmpRun").innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Running…';
      const depthLimit = Math.max(0, parseInt($("#cmpDepth").value, 10) || 0);
      const body = $("#cmpBody");
      body.innerHTML = ROWS.map(
        (row, i) => `<tr id="cmpRow${i}" class="${row.algo === "gbfs" ? "assigned" : ""}">
          <td class="algo-name">${rowLabel(row)}</td><td>${Search.ALGORITHMS[row.algo].type}</td>
          <td colspan="8" class="text-muted-2"><span class="spinner-border spinner-border-sm me-2 d-none"></span>waiting…</td></tr>`
      ).join("");
      $("#cmpChart").innerHTML = '<p class="empty">—</p>';
      $("#cmpInsights").innerHTML = '<p class="empty">Running…</p>';

      const results = [];
      for (let i = 0; i < ROWS.length; i++) {
        const row = ROWS[i];
        const tr = $(`#cmpRow${i}`);
        tr.cells[2].innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>running…';
        let r;
        try {
          r = await runner.solve(row.algo, start, goal, { heuristic: row.h || "manhattan", depthLimit, traceLimit: 0 });
        } catch (e) {
          if (my !== token) return;
          r = null;
        }
        if (my !== token) return;
        results.push({ row, r });
        if (!r) {
          tr.cells[2].textContent = "error";
          continue;
        }
        tr.innerHTML = `<td class="algo-name">${rowLabel(row)}</td><td>${Search.ALGORITHMS[row.algo].type}</td>
          <td>${r.found ? '<span class="pill pill-ok">Yes</span>' : `<span class="pill pill-bad" title="${esc(r.reason)}">No</span>`}</td>
          <td class="num">${r.found ? fmt(r.moves.length) : "–"}</td>
          <td class="num">${fmt(r.expanded)}</td>
          <td class="num">${fmt(r.generated)}</td>
          <td class="num">${fmt(r.maxDepth)}</td>
          <td class="num">${fmtTime(r.timeMs)}</td>
          <td><span class="pill ${memLevel(r.memoryKB) === "Low" ? "pill-ok" : memLevel(r.memoryKB) === "Medium" ? "pill-warn" : "pill-bad"}">${memLevel(r.memoryKB)}</span> <span class="mono small text-muted-2">${fmtMem(r.memoryKB)}</span></td>
          <td class="opt">…</td>`;
      }
      running = false;
      $("#cmpRun").disabled = false;
      $("#cmpRun").textContent = "Run comparison";

      const astar = results.find((x) => x.row.algo === "astar" && x.row.h === "manhattan");
      const optimal = astar && astar.r && astar.r.found ? astar.r.moves.length : null;
      results.forEach((x, i) => {
        const cell = $(`#cmpRow${i} .opt`);
        if (!cell || !x.r) return;
        cell.innerHTML = !x.r.found ? "–" : x.r.moves.length === optimal ? '<span class="pill pill-ok">Yes</span>' : `<span class="pill pill-warn">No (+${fmt(x.r.moves.length - optimal)})</span>`;
      });
      renderChart(results);
      renderInsights(results, optimal, depthLimit);
    }

    function renderChart(results) {
      const ok = results.filter((x) => x.r);
      const max = Math.max(...ok.map((x) => x.r.expanded), 1);
      const scale = (v) => (Math.log10(v + 1) / Math.log10(max + 1)) * 100;
      $("#cmpChart").innerHTML = ok
        .map(
          (x) => `<div class="bar-row"><span class="bar-label">${rowText(x.row)}</span>
            <div class="bar-track"><div class="bar-fill ${x.row.algo === "gbfs" ? "gbfs" : x.row.algo === "astar" ? "astar" : ""}" data-w="${scale(x.r.expanded).toFixed(1)}"></div></div>
            <span class="bar-val">${fmt(x.r.expanded)}</span></div>`
        )
        .join("");
      requestAnimationFrame(() => $$("#cmpChart .bar-fill").forEach((b) => (b.style.width = b.dataset.w + "%")));
    }

    function renderInsights(results, optimal, depthLimit) {
      const get = (algo, h) => {
        const x = results.find((y) => y.row.algo === algo && (h ? y.row.h === h : true));
        return x && x.r;
      };
      const gb = get("gbfs", "manhattan");
      const gb1 = get("gbfs", "misplaced");
      const bfs = get("bfs");
      const a2 = get("astar", "manhattan");
      const a1 = get("astar", "misplaced");
      const dfs = get("dfs");
      const dls = get("dls");
      const out = [];
      if (gb && bfs && gb.found) {
        const ratio = bfs.expanded / Math.max(1, gb.expanded);
        out.push(`<b>GBFS (Manhattan)</b> expanded <b>${fmt(gb.expanded)}</b> nodes, ${ratio >= 1.5 ? `about <b>${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× fewer</b> than` : "compared with"} BFS's ${fmt(bfs.expanded)}.`);
      }
      if (gb && gb.found && optimal !== null) {
        out.push(
          gb.moves.length === optimal
            ? `Here GBFS's path of <b>${optimal} moves</b> happens to be optimal. On harder puzzles it often is not (try the “Hardest” example: 47 moves against an optimum of 31).`
            : `GBFS's path is <b>${fmt(gb.moves.length)} moves</b> against an optimum of <b>${optimal}</b>. That is the cost of ranking nodes by h(n) alone.`
        );
      }
      if (gb && gb1 && gb.found && gb1.found) {
        out.push(
          gb1.expanded === gb.expanded && gb1.moves.length === gb.moves.length
            ? `On this puzzle both heuristics guided GBFS identically (${fmt(gb.expanded)} expansions, ${fmt(gb.moves.length)} moves). Try a harder puzzle to see them diverge.`
            : `Heuristic choice matters for GBFS: Misplaced Tiles expanded ${fmt(gb1.expanded)} nodes (${fmt(gb1.moves.length)} moves) and Manhattan expanded ${fmt(gb.expanded)} (${fmt(gb.moves.length)} moves).`
        );
      }
      if (a1 && a2 && a1.found && a2.found) {
        out.push(
          a2.expanded < a1.expanded
            ? `<b>A*</b> is optimal with both heuristics, but Manhattan (which dominates Misplaced Tiles) needed only ${fmt(a2.expanded)} expansions against ${fmt(a1.expanded)}.`
            : `<b>A*</b> found the optimal ${fmt(a2.moves.length)}-move path with both heuristics (${fmt(a2.expanded)} vs ${fmt(a1.expanded)} expansions).`
        );
      }
      if (dfs && dfs.found) {
        out.push(`<b>DFS</b> found a path of ${fmt(dfs.moves.length)} moves after ${fmt(dfs.expanded)} expansions. It is complete in this finite space, but far from optimal.`);
      }
      if (dls) {
        out.push(
          dls.found
            ? `<b>DLS</b> (l = ${depthLimit}) found a ${fmt(dls.moves.length)}-move solution${optimal !== null && dls.moves.length > optimal ? ", which is not optimal because l > d" : ""}.`
            : `<b>DLS</b> with l = ${depthLimit} failed${optimal !== null ? ` because the shortest solution needs ${optimal} moves (l < d)` : ""}.`
        );
      }
      $("#cmpInsights").innerHTML = out.map((t) => `<div class="insight">${t}</div>`).join("") || '<p class="empty">—</p>';
    }

    startEl.addEventListener("input", () => (touched = true));
    goalEl.addEventListener("input", () => (touched = true));
    $("#cmpRun").addEventListener("click", () => {
      if (!running) run();
    });
    $("#cmpRandom").addEventListener("click", () => {
      let goal;
      try {
        goal = Puzzle.parse(goalEl.value);
      } catch (e) {
        goal = Puzzle.parse("123804765");
        goalEl.value = Puzzle.format(goal);
      }
      startEl.value = Puzzle.format(Puzzle.randomSolvable(goal, 25));
      touched = true;
      if (running) {
        token++;
        runner.cancel();
        running = false;
      }
      run();
    });

    return { onShow };
  })();

  /* =========================== Algorithm information =========================== */
  (function renderInfo() {
    const order = ["bfs", "dfs", "dls", "iddls", "ucs", "gbfs", "astar"];
    const STRUCT = {
      bfs: "FIFO queue",
      dfs: "LIFO stack",
      dls: "LIFO stack + depth limit",
      iddls: "Repeated DLS, l = 0, 1, 2, …",
      ucs: "Priority queue on g(n)",
      gbfs: "Priority queue on h(n)",
      astar: "Priority queue on g(n) + h(n)",
    };
    const SHORT = {
      bfs: ["Yes", "Yes*"],
      dfs: ["Yes†", "No"],
      dls: ["If l ≥ d", "No"],
      iddls: ["Yes", "Yes*"],
      ucs: ["Yes", "Yes"],
      gbfs: ["Yes†", "No"],
      astar: ["Yes", "Yes‡"],
    };
    const byId = Object.fromEntries(ALGORITHM_INFO.map((a) => [a.id, a]));
    $("#glanceTable").innerHTML =
      `<thead><tr><th>Algorithm</th><th>Type</th><th>Open list</th><th>Complete</th><th>Optimal</th><th>Time</th><th>Space</th></tr></thead><tbody>` +
      order
        .map((id) => {
          const a = byId[id];
          return `<tr class="${a.assigned ? "assigned" : ""}"><td><b>${a.short}</b>${a.assigned ? ' <span class="pill pill-gbfs">assigned</span>' : ""}</td><td>${a.type}</td><td>${STRUCT[id]}</td><td>${SHORT[id][0]}</td><td>${SHORT[id][1]}</td><td class="mono small">${a.time.split(";")[0]}</td><td class="mono small">${a.space.split("—")[0]}</td></tr>`;
        })
        .join("") +
      `</tbody><caption class="hint">* for unit step costs · † graph search (explored list) in a finite state space · ‡ with an admissible heuristic</caption>`;

    $("#heuristicCards").innerHTML = HEURISTIC_INFO.map(
      (h) => `<div class="col-md-6"><div class="h-card"><h3>${h.name}</h3><div class="formula">${h.formula}</div><p>${h.notes}</p><p class="mb-0"><b>Example:</b> ${h.example}</p></div></div>`
    ).join("");

    const list = (items, tag = "ul") => `<${tag}>${items.map((i) => `<li>${i}</li>`).join("")}</${tag}>`;
    $("#algoAccordion").innerHTML = ALGORITHM_INFO.map(
      (a, i) => `<div class="accordion-item">
        <h3 class="accordion-header">
          <button class="accordion-button ${i === 0 ? "" : "collapsed"}" type="button" data-bs-toggle="collapse" data-bs-target="#acc-${a.id}" aria-expanded="${i === 0}">
            ${a.name} <span class="pill ${a.type === "Informed" ? "pill-accent" : "pill-muted"}">${a.type}</span>${a.assigned ? '<span class="pill pill-gbfs">Assigned · No. 6</span>' : ""}
          </button>
        </h3>
        <div id="acc-${a.id}" class="accordion-collapse collapse ${i === 0 ? "show" : ""}">
          <div class="accordion-body">
            <h4>Description</h4><p class="mb-0">${a.description}</p>
            <h4>Working principle</h4>${list(a.principle, "ol")}
            <div class="row g-4">
              <div class="col-md-6"><h4>Advantages</h4>${list(a.advantages)}</div>
              <div class="col-md-6"><h4>Limitations</h4>${list(a.limitations)}</div>
            </div>
            <div class="props">
              <div><span>Time complexity</span><b>${a.time}</b></div>
              <div><span>Space complexity</span><b>${a.space}</b></div>
              <div><span>Completeness</span><b>${a.complete}</b></div>
              <div><span>Optimality</span><b>${a.optimal}</b></div>
            </div>
          </div>
        </div>
      </div>`
    ).join("");
  })();

  /* ================================ Footer link ================================ */
  (function repoLink() {
    const host = location.hostname;
    if (host.endsWith(".github.io")) {
      const user = host.replace(".github.io", "");
      const repo = location.pathname.split("/").filter(Boolean)[0] || `${user}.github.io`;
      $("#repoLink").href = `https://github.com/${user}/${repo}`;
    }
  })();

  window.addEventListener("hashchange", route);
  route();
})();
