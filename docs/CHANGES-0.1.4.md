# Changes in 0.1.4

- Left and right panes resize by dragging their dividers or using arrow keys while a divider is focused. Width preferences persist; Restore workspace resets them.
- Text object names and layer labels follow the first six words of their content. Typography and color/stroke controls appear before Position & Size.
- Designed pages support embedded PNG/JPEG backgrounds, existing artwork selection, Fill page or Fit whole picture, replacement and removal. Backgrounds are behind objects, survive save/reopen and undo, appear in thumbnails and PDF, and receive resolution checks.
- Page numbers have expandable decimal/Roman format, starting value, top/bottom placement, center/outside alignment, typeface, size, color, bold and italic settings. Canvas, thumbnails, manuscript pages and PDF share the format.
- Fit Page uses actual viewport dimensions, captions, padding and guide space instead of an arbitrary zoom ceiling. Fit mode responds to pane/window changes. Manual zoom remains independent.
- Facing view keeps pairs 1–2, 3–4, etc. Selecting page 2 focuses the right side of the first pair. Either canvas can be selected and edited; the final unpaired page appears alone. Picture-book outside margins and number placement follow these pairs.
- Create a New Book places a compact units dropdown and the preview directly below Book Size. Initial focus does not scroll. The default form fits at 960 × 640; expanded/custom settings retain internal scrolling.

Validation: 23 core, 5 native storage and 20 browser tests; independent PDF text/image/page-box checks and visual review. The Windows executable and NSIS installer are versioned 0.1.4. Native clean-machine installation remains untested.
