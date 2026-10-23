# GBFS hand trace: assignment example

**Initial** `283 / 164 / 7_5`  →  **Goal** `123 / 8_4 / 765`  ·  heuristic: **Manhattan distance**  ·  f(n) = h(n)

This is the exact output of `Search.solve("gbfs", …)` and matches what the visualiser shows frame by frame.

| Step | Node expanded (g, h) | Successors generated (h, status) | Frontier size | Explored size |
|---|---|---|---|---|
| 1 | `283/164/7_5` (g=0, **h=5**) | Up `283/1_4/765` (h=4, added) · Left `283/164/_75` (h=6, added) · Right `283/164/75_` (h=6, added) | 3 | 1 |
| 2 | `283/1_4/765` (g=1, **h=4**) | Up `2_3/184/765` (h=3, added) · Down `283/164/7_5` (explored) · Left `283/_14/765` (h=5, added) · Right `283/14_/765` (h=5, added) | 5 | 2 |
| 3 | `2_3/184/765` (g=2, **h=3**) | Down (explored) · Left `_23/184/765` (h=2, added) · Right `23_/184/765` (h=4, added) | 6 | 3 |
| 4 | `_23/184/765` (g=3, **h=2**) | Down `123/_84/765` (h=1, added) · Right (explored) | 6 | 4 |
| 5 | `123/_84/765` (g=4, **h=1**) | Up (explored) · Down `123/784/_65` (h=2, added) · Right `123/8_4/765` (h=0, added) | 7 | 5 |
| 6 | `123/8_4/765` (g=5, **h=0**): **goal test passes** | — | 6 | 5 |

**Result:** solution found. Moves = **Up, Up, Left, Down, Right** (blank direction) · path cost 5 · nodes generated 16 · nodes expanded 5 · max depth 4.

At every step GBFS picks the frontier node with the smallest h(n), and here h decreases by exactly 1 per move (5 → 4 → 3 → 2 → 1 → 0). So it reaches the goal without exploring any side branch and the path happens to be optimal. On harder puzzles h does not decrease this smoothly, and GBFS then commits to detours (for example 47 moves instead of the optimal 31 on `867/254/3_1 → 123/456/78_`).
