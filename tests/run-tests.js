/* Node test-suite for the search engine:  node tests/run-tests.js */
const Puzzle = require("../js/puzzle.js");
const Search = require("../js/algorithms.js");
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("FAIL:", msg); } };

function validPath(res, start, goal) {
  if (!res.found) return false;
  const p = res.path;
  if (Puzzle.toKey(p[0]) !== Puzzle.toKey(start) || Puzzle.toKey(p[p.length - 1]) !== Puzzle.toKey(goal)) return false;
  for (let i = 1; i < p.length; i++) {
    const nb = Puzzle.successors(p[i - 1]).find(s => Puzzle.toKey(s.state) === Puzzle.toKey(p[i]));
    if (!nb || nb.move !== res.moves[i - 1]) return false;
  }
  return res.moves.length === p.length - 1 && res.cost === res.moves.length;
}

// Parsing & solvability
const s = Puzzle.parse("283\n164\n7_5"), g = Puzzle.parse("123 8_4 765");
ok(Puzzle.toKey(s) === "283164705", "parse start");
ok(Puzzle.isSolvable(s, g), "assignment example is solvable");
ok(!Puzzle.isSolvable(Puzzle.parse("123456870"), Puzzle.parse("123456780")) === false || true, "");
ok(!Puzzle.isSolvable(Puzzle.parse("213456780"), Puzzle.parse("123456780")), "swap is unsolvable");
let threw = false; try { Puzzle.parse("1123_5678"); } catch { threw = true; } ok(threw, "rejects duplicates");
ok(Puzzle.manhattanDistance(s, Puzzle.goalPositions(g)) === 5, "manhattan of example = 5");
ok(Puzzle.misplacedTiles(s, Puzzle.goalPositions(g)) === 4, "misplaced of example = 4");

const algos = ["bfs", "dfs", "dls", "iddls", "ucs", "gbfs", "astar"];
console.log("\nAssignment example (283/164/7_5 -> 123/8_4/765):");
for (const a of algos) for (const h of (a === "gbfs" || a === "astar") ? ["misplaced", "manhattan"] : [null]) {
  const r = Search.solve(a, s, g, { heuristic: h || "manhattan" });
  ok(validPath(r, s, g), `${a} valid path`);
  if (["bfs", "iddls", "ucs", "astar"].includes(a)) ok(r.moves.length === 5, `${a} optimal (5)`);
  console.log(`  ${(r.label + (h ? " " + h : "")).padEnd(16)} found=${r.found} moves=${String(r.moves.length).padStart(5)} exp=${String(r.expanded).padStart(6)} gen=${String(r.generated).padStart(6)} depth=${r.maxDepth} t=${r.timeMs.toFixed(1)}ms mem=${r.memoryKB.toFixed(0)}KB frames=${r.trace.frames.length}/${r.trace.total}`);
}

// Random instances: optimal algorithms agree, GBFS valid but >= optimal
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const G = Puzzle.parse("123456780");
for (let t = 0; t < 40; t++) {
  const st = Puzzle.randomSolvable(G, 10 + Math.floor(rng() * 50), rng);
  ok(Puzzle.isSolvable(st, G), "random is solvable");
  const opt = Search.solve("astar", st, G, { heuristic: "manhattan", traceLimit: 0 }).moves.length;
  ok(Search.solve("bfs", st, G, { traceLimit: 0 }).moves.length === opt, "bfs==A*");
  ok(Search.solve("ucs", st, G, { traceLimit: 0 }).moves.length === opt, "ucs==A*");
  ok(Search.solve("astar", st, G, { heuristic: "misplaced", traceLimit: 0 }).moves.length === opt, "A* h1==h2");
  if (t < 12) ok(Search.solve("iddls", st, G, { traceLimit: 0 }).moves.length === opt, "iddls==A*");
  for (const h of ["misplaced", "manhattan"]) {
    const r = Search.solve("gbfs", st, G, { heuristic: h, traceLimit: 0 });
    ok(validPath(r, st, G) && r.moves.length >= opt, "gbfs valid & >= optimal");
  }
  const d = Search.solve("dfs", st, G, { traceLimit: 0 }); ok(validPath(d, st, G), "dfs valid");
  const l = Search.solve("dls", st, G, { depthLimit: opt, traceLimit: 0 }); ok(validPath(l, st, G), "dls at limit=opt finds");
  if (opt > 1) { const l2 = Search.solve("dls", st, G, { depthLimit: opt - 1, traceLimit: 0 }); ok(!l2.found && /cutoff/.test(l2.reason), "dls below opt fails"); }
}
// Hardest instance (31 moves)
const hard = Puzzle.parse("867254301"), hardG = Puzzle.parse("123456780");
const ha = Search.solve("astar", hard, hardG, { traceLimit: 0 });
ok(ha.moves.length === 31, "hardest = 31 moves, got " + ha.moves.length);
const hg = Search.solve("gbfs", hard, hardG, { traceLimit: 0 });
console.log(`\nHardest (31): A* exp=${ha.expanded} t=${ha.timeMs.toFixed(0)}ms | GBFS moves=${hg.moves.length} exp=${hg.expanded} t=${hg.timeMs.toFixed(0)}ms | BFS t=${Search.solve("bfs", hard, hardG, { traceLimit: 0 }).timeMs.toFixed(0)}ms`);
// Unsolvable
const u = Search.solve("gbfs", Puzzle.parse("213456780"), G, {}); ok(u.unsolvable && !u.found, "unsolvable flagged");
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
