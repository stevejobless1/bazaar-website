## 2026-05-17 - Adding aria-hidden to decorative icons
**Learning:** Found several decorative icons (e.g. Search and Lock icons) without aria-hidden, which can be confusing for screen reader users. Also observed some forms inputs lacking proper labels.
**Action:** Always verify that decorative icons have aria-hidden="true" and inputs have associated aria-labels or matching id/htmlFor attributes when building forms.
