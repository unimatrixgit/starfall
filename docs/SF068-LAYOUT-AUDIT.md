# SF-068 layout audit — first pass

144 local browser cases:24 page/subview combinations × widths1440/768/390 × Neutral/Borg. Tests used an isolated account fixture, not the production round. Intentional horizontal table scroll wrappers were excluded from frame-escape reports. The authorised Info overlay over the right rail is not a defect. Empty orders and short fixture text do not certify long receipts, long names, populated shared boards or every theme.

Confirmed common issue L01: the decorative .rail-decoration circle has right:-38px and extends document width by38px. A visible DOM inspection found the decorative element at right1478 on a1440px viewport. This explains the repeated page-width finding across all144cases; it is one shared layout issue, not144independent defects. Suggested correction: contain or reposition the decoration without clipping the authorised Info overlay.

Candidates requiring visual confirmation L02: at768px, the population survey panel reports clipped horizontal content in Neutral/Borg; the Borg population-detail panel also reports clipping. These are geometry signals, not yet certified text-loss defects. Inspect longest survey lore, the growth formula and header labels at this breakpoint before selecting a fix.

No other unscrollable frame escape was detected by this first pass. That is a bounded observation, not an all-pages/layout guarantee. Full raw results are in SF068-LAYOUT-OBSERVATIONS.json.

## v0.126.1 follow-up

Repeated all 144 cases after the rail decoration, population wrapping and compact tax-panel container fixes. No page-width, unscrollable frame escape or clipped-content flags remain in the current fixture. The resource circles and additional 24px desktop/18px mobile page gap were separately browser checked. This does not certify every long-content or theme combination.
