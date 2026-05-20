## 2024-05-24 - Memoizing recursive React calculations
**Learning:** In deeply recursive tree traversals (like recipe calculations) that run on the frontend when analyzing many items (e.g. 50+ flips with identical base components), duplicating the path traversal O(Tree Depth) for every top-level target is a major performance bottleneck, leading to O(N * Tree Depth). Memoizing the required base ingredients for one unit in a local Map scope significantly reduces redundant operations by resolving sub-trees incrementally.
**Action:** Always look for overlapping subproblems in multi-item recursive analysis components on the frontend and implement `useMemo` backed by Map or Object caching to convert structural duplication into O(1) lookups.
## 2024-05-24 - Optimize Jacob's contest grouping to avoid high-frequency date formatting
**Learning:** `Intl` API date formatting inside a high-frequency `useMemo` dependency (like one ticking every second for countdowns) is very slow in JavaScript and causes main-thread blocking.
**Action:** Move expensive grouping/formatting operations to run only on actual data updates (e.g., API fetches) and apply dynamic runtime filtering during rendering to filter out old state.
## 2024-05-24 - Memoize derived lists in main app view
**Learning:** In the main App view (`Home` component), derived lists such as `enrichedProducts` and `displayProducts` were being re-calculated on every render, which becomes a major performance bottleneck (O(N log N) due to sorting) when switching tabs or when parent state updates.
**Action:** Always memoize derived lists and expensive calculations using `useMemo` with appropriate dependencies, and ensure they are placed before any conditional early returns to avoid violating React's Rules of Hooks.
