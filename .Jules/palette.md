## 2026-05-14 - Native interactive elements for toggles
**Learning:** In the AutoPlanner, `div` wrappers were used with `onClick` to act as custom toggle switches for "MAX Quantity" and "Block Slots Mode". This makes them entirely inaccessible via keyboard navigation or screen readers.
**Action:** Replace pseudo-interactive `div` elements with semantic native `<button type="button" role="switch" aria-checked="...>` tags with reset styles for true accessibility without losing visual consistency.
