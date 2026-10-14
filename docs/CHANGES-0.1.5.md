# Book Designer 0.1.5

- Manuscript formatting and the chapter title now live in the main header. New Hybrid and Text Only books fit the available page height and width, including after pane or window resizing.
- Page thumbnails retain their aspect ratio at any pane width. Each has a delete button with confirmation. Designed-page deletion removes its objects; manuscript-page deletion removes that page's text and reflows the rest. Both support undo. A manuscript retains an editable blank page when all its content is removed.
- Margins start collapsed, numbering controls appear only when numbering is enabled, and duplicate book metadata labels have been removed. Title and author fields retain accessible names and placeholders.
- Importing artwork into Assets adds it only to the library, including while a manuscript page is active. Placement requires double-click, drag/drop, Enter, or the asset context menu's Add to page command. Insert Image continues to import and place directly.
- Open application menus switch as the pointer moves between menu headings. The decorative app icon is no longer a button and the adjacent app-name text is removed.
- Background color swatches are taller. Separate buttons apply the current color or picture (including its fit setting) to every designed and manuscript page in a single undoable action. Manuscript backgrounds are stored per chapter and follow text reflow. Editor, preview, thumbnails and PDF share these settings.

Validation: 26 core tests, 24 headless browser workflows, TypeScript checking, production build and 5 native storage tests. Windows x64 installer and portable app are versioned 0.1.5. Clean-machine installation remains an acceptance task.
