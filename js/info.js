/**
 * info.js — Content for the Algorithm Information page.
 * b = branching factor (≈ 2.67 for the 8-puzzle), d = depth of the shallowest goal,
 * m = maximum depth of the state space, l = depth limit, C* = optimal cost, ε = minimum step cost.
 */
(function (global) {
  "use strict";

  const ALGORITHM_INFO = [
    {
      id: "gbfs",
      name: "Greedy Best First Search",
      short: "GBFS",
      type: "Informed",
      assigned: true,
      description:
        "Greedy Best First Search expands the node that appears closest to the goal, judged only by the heuristic h(n). It ignores how much it has already cost to reach a node, so it rushes towards states that look good.",
      principle: [
        "Evaluation function f(n) = h(n). The path cost g(n) is not used to rank nodes.",
        "The frontier (open list) is a priority queue ordered by h(n), ties broken first-in-first-out.",
        "Pop the node with the smallest h(n). If it is the goal, stop and trace parents back to the start.",
        "Otherwise move it to the explored (closed) list and generate its successors by moving the blank Up, Down, Left or Right.",
        "Add each successor that is in neither the frontier nor the explored list, with its parent pointer and h value.",
        "Repeat until the goal is selected or the frontier is empty.",
      ],
      advantages: [
        "Usually expands far fewer nodes than any uninformed search, so it is very fast.",
        "Low memory use on typical instances because it heads straight for the goal.",
        "Simple to implement once a heuristic is available.",
      ],
      limitations: [
        "Not optimal: the first solution it finds is often longer than the shortest one.",
        "Can be misled by the heuristic into long detours (e.g. 47 moves on a puzzle whose optimum is 31).",
        "Worst-case time and memory are still exponential.",
        "Tree-search version (without an explored list) can loop forever.",
      ],
      time: "O(bᵐ) worst case; a good heuristic reduces it dramatically",
      space: "O(bᵐ) — keeps all generated nodes in memory",
      complete: "Yes in a finite state space with an explored list (graph search); no for tree search",
      optimal: "No",
    },
    {
      id: "astar",
      name: "A* Search",
      short: "A*",
      type: "Informed",
      description:
        "A* combines the cost already paid with the estimated cost still to go. It expands the node with the lowest f(n) = g(n) + h(n), which makes it both efficient and optimal with an admissible heuristic.",
      principle: [
        "Evaluation function f(n) = g(n) + h(n).",
        "The frontier is a priority queue ordered by f(n) (ties broken by smaller h).",
        "Pop the lowest-f node; stop if it is the goal.",
        "Expand it and add successors. If a cheaper path to a state already in the frontier is found, the state is re-queued with the better g.",
        "Both Misplaced Tiles and Manhattan Distance are admissible and consistent, so the first time the goal is selected its path is optimal.",
      ],
      advantages: [
        "Optimal and complete with an admissible heuristic.",
        "Optimally efficient: no other optimal algorithm using the same heuristic expands fewer nodes.",
        "A better heuristic (Manhattan) gives a large speed-up over a weaker one (Misplaced).",
      ],
      limitations: [
        "Keeps every generated node in memory, which becomes the bottleneck on large problems.",
        "Performance depends heavily on heuristic quality.",
      ],
      time: "O(bᵈ) worst case; exponential in the heuristic error",
      space: "O(bᵈ)",
      complete: "Yes (finite branching, step costs ≥ ε > 0)",
      optimal: "Yes, with an admissible heuristic (consistent for graph search)",
    },
    {
      id: "bfs",
      name: "Breadth First Search",
      short: "BFS",
      type: "Uninformed",
      description:
        "BFS explores the state space level by level: every state at depth d is expanded before any state at depth d + 1.",
      principle: [
        "The frontier is a FIFO queue.",
        "Dequeue the oldest node; stop if it is the goal.",
        "Expand it and enqueue every successor not already seen.",
        "Because levels are completed in order, the first goal found is at the shallowest depth.",
      ],
      advantages: ["Complete.", "Optimal when every move costs the same (true for the 8-puzzle).", "Simple and predictable."],
      limitations: [
        "Memory grows exponentially with depth; it stores the whole frontier.",
        "Expands many irrelevant states because it has no sense of direction.",
      ],
      time: "O(bᵈ)",
      space: "O(bᵈ)",
      complete: "Yes (finite b)",
      optimal: "Yes for unit step costs",
    },
    {
      id: "dfs",
      name: "Depth First Search",
      short: "DFS",
      type: "Uninformed",
      description: "DFS always expands the deepest node in the frontier, following one branch as far as it goes before backtracking.",
      principle: [
        "The frontier is a LIFO stack.",
        "Pop the most recently added node; stop if it is the goal.",
        "Mark it explored and push its successors, so the first generated move is tried first.",
        "Backtrack when a node has no unexplored successors.",
      ],
      advantages: [
        "Memory is linear in depth for the tree-search version.",
        "Can find a solution quickly if one lies along the first branch tried.",
      ],
      limitations: [
        "Not optimal; on the 8-puzzle it typically returns paths that are tens of thousands of moves long.",
        "Can wander through most of the 181,440 reachable states before finding the goal.",
        "Tree-search DFS can loop forever; an explored list is needed.",
      ],
      time: "O(bᵐ)",
      space: "O(bm) tree search; O(bᵐ) with an explored list",
      complete: "Yes in a finite space with an explored list; no otherwise",
      optimal: "No",
    },
    {
      id: "dls",
      name: "Depth Limited Search",
      short: "DLS",
      type: "Uninformed",
      description: "DLS is DFS with a depth limit l: nodes at depth l are treated as if they had no successors.",
      principle: [
        "Run DFS with a LIFO stack.",
        "Do not expand a node whose depth equals the limit l; report a cutoff instead.",
        "This implementation remembers the shallowest depth each state was reached at and re-expands a state only when it is reached at a shallower depth, which avoids repeated work while staying complete within the limit.",
      ],
      advantages: ["Solves DFS's infinite-path problem.", "Memory is bounded by the limit.", "Useful when the solution depth is known."],
      limitations: [
        "Incomplete if l < d (no solution within the limit).",
        "Not optimal if l > d; it may return a deeper solution first.",
        "Choosing a good l needs domain knowledge.",
      ],
      time: "O(bˡ)",
      space: "O(bl)",
      complete: "Only if l ≥ d",
      optimal: "No (only if l = d)",
    },
    {
      id: "iddls",
      name: "Iterative Deepening Depth Limited Search",
      short: "IDDLS",
      type: "Uninformed",
      description: "IDDLS runs DLS with limits 0, 1, 2, … until a solution is found. It combines the low memory of DFS with the completeness and optimality of BFS.",
      principle: [
        "For l = 0, 1, 2, … run Depth Limited Search with limit l.",
        "If DLS finds the goal, return it; its depth is the shallowest possible.",
        "If DLS finishes with no cutoff, the whole space was searched and there is no solution.",
        "Otherwise increase l and repeat.",
      ],
      advantages: [
        "Complete and optimal for unit step costs.",
        "Memory is linear in depth.",
        "Repeated work is small because most nodes are at the deepest level.",
      ],
      limitations: [
        "Re-expands shallow nodes on every iteration.",
        "Can be slow on deep instances (20+ moves).",
      ],
      time: "O(bᵈ)",
      space: "O(bd)",
      complete: "Yes (finite b)",
      optimal: "Yes for unit step costs",
    },
    {
      id: "ucs",
      name: "Uniform Cost Search",
      short: "UCS",
      type: "Uninformed",
      description: "UCS expands the node with the lowest path cost g(n). With unit move costs it behaves like BFS.",
      principle: [
        "The frontier is a priority queue ordered by g(n).",
        "Pop the cheapest node; stop if it is the goal.",
        "Expand it; if a cheaper path to a frontier state is found, update it.",
      ],
      advantages: ["Complete and optimal for any non-negative step costs.", "Generalises BFS to weighted moves."],
      limitations: ["No guidance towards the goal, so it explores in all directions.", "Memory grows exponentially."],
      time: "O(b^(1 + ⌊C*/ε⌋))",
      space: "O(b^(1 + ⌊C*/ε⌋))",
      complete: "Yes (step costs ≥ ε > 0)",
      optimal: "Yes",
    },
  ];

  const HEURISTIC_INFO = [
    {
      id: "misplaced",
      name: "Misplaced Tiles — h₁(n)",
      formula: "h₁(n) = number of tiles (excluding the blank) that are not in their goal position",
      notes:
        "Admissible: every misplaced tile needs at least one move. Consistent: one move changes h₁ by at most 1. It is cheap to compute but a weak estimate.",
      example: "For 283/164/7_5 → 123/8_4/765, tiles 2, 8, 1 and 6 are out of place, so h₁ = 4.",
    },
    {
      id: "manhattan",
      name: "Manhattan Distance — h₂(n)",
      formula: "h₂(n) = Σ over tiles of |row − goalRow| + |col − goalCol|",
      notes:
        "Admissible: each tile must travel at least its grid distance, one square per move. Consistent: a move shifts one tile by one square, so h₂ changes by exactly 1. h₂(n) ≥ h₁(n) for every state, so h₂ dominates h₁ and guides the search better.",
      example: "For the same puzzle: 2→1, 8→2, 1→1, 6→1, others 0, so h₂ = 5 (here equal to the true optimal cost).",
    },
  ];

  global.ALGORITHM_INFO = ALGORITHM_INFO;
  global.HEURISTIC_INFO = HEURISTIC_INFO;
})(typeof window !== "undefined" ? window : globalThis);
