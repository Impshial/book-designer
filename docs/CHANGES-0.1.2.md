# Changes in 0.1.2

- New Book is titled **Create a New Book**. The save-location controls, introductory eyebrow, explanatory trim/page notes and preview footer decoration are removed.
- The full-width Book size dropdown lists the selected style's presets with their name, dimensions and suggested use. Measurement units appear below it. Width and height appear only for **Custom size**; there is no orientation button.
- The preset catalog follows the supplied `book-size-presets.xlsx`, sheet **Book sizes**, rows 7–21: six Picture Book, five Hybrid and four Text Only sizes, in source order with the marked defaults. Dimensions retain exact source inches and convert for display. Standard Square uses the requested description, “Recommended size for picture books.” The workbook's separate International A5 category is not shown among the three style-specific lists.
- Creation always starts an unsaved book. The first Save chooses a destination; existing Save/Discard/Cancel guards protect unsaved and edited books.
- The dialog keeps its fixed dimensions, style-button order, focus trap and native window locking. Custom fields and advanced settings scroll inside the dialog without moving its footer.
- Browser regression coverage verifies all preset labels and dimensions against an independently extracted workbook fixture, style defaults, conversion and persistence, custom fields, validation, layout and removed content.

The Windows executable and NSIS installer are versioned 0.1.2. See `VERIFICATION.md` for validation and the remaining native installation checks.
