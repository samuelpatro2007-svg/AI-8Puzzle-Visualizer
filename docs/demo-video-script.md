# Demo video script (3–5 minutes)

Record the browser with OBS Studio, the Xbox Game Bar (Win + G) or the macOS screenshot toolbar (Cmd + Shift + 5). Talk over it in your own words; the lines below are a guide.

| Time | Screen | What to say |
|---|---|---|
| 0:00–0:30 | **Home page** | Introduce yourself (name, 24BCE0867), the course and the assignment title. Your assigned algorithm is No. 6, Greedy Best First Search. Briefly describe the 8-puzzle: 3 × 3 board, slide tiles into the blank, reach the goal. |
| 0:30–0:55 | Home → *state-space formulation* | States, actions (move blank Up/Down/Left/Right), goal test, path cost = number of moves. Mention 181,440 reachable states and the inversion-parity solvability rule. |
| 0:55–1:20 | **Solver** → input panel | Show Method 1 (type `283/164/7_5` and `123/8_4/765`), the examples list, and Method 2 **Generate Random Puzzle**. Show that the unsolvable example is rejected. |
| 1:20–2:40 | Solver → run **GBFS + Manhattan** on the assignment example | Press **Run**, then **Pause** after one or two frames. Point out the current node, parent node, generated successors with their h values, frontier sorted by h, explored list, and the counters. Explain that **f(n) = h(n)**: g(n) is shown but not used for ordering. Use **Next / Previous** to step, change the **Speed**, then **Resume**. Show the animated blank moving along the solution path and the **Solution summary**. |
| 2:40–3:10 | Solver → **Hardest (31 moves)** with GBFS | Run it and skip to the solution. The summary says GBFS found **47 moves** while the optimum is **31**. This shows GBFS is fast (≈100 expansions) but **not optimal**. Switch the heuristic to Misplaced Tiles and compare. |
| 3:10–4:00 | **Comparison** page | Run the comparison on the Medium example. Compare nodes expanded and moves: GBFS expands far fewer nodes than BFS/IDDLS/UCS but gives a longer path. A* with Manhattan is both optimal and efficient. DFS gives a huge path, and DLS depends on the limit. Point to the log-scale chart. |
| 4:00–4:30 | **Algorithms** page | Open the GBFS card: working principle, advantages and limitations, complexity O(bᵐ), complete in a finite space with an explored list, not optimal. Show the two heuristics: both admissible, Manhattan dominates Misplaced Tiles. |
| 4:30–4:50 | GitHub repo + README | Show the repository structure, README and the live GitHub Pages URL. Toggle dark mode and show the mobile layout if there's time. Thank the viewer. |

**Tip:** before recording, set the speed to about 3× so each GBFS expansion is easy to follow.
