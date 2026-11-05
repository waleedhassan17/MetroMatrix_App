# The MetroMatrix logo and app icons

`logo.png` is the owner's logo (2026-11-05), kept exactly as it was given: 512 × 512, an off-white tile with four
rounded squares, the green one carrying a white "M". Never edit, recompress or resize it.

`logo.svg` is that logo traced to vector: the same tile, squares, "M" and colours. It matches `logo.png` to within
compression noise. Every icon below is exported from it with `npm run export:logo` (headless Chrome), so each size is
drawn fresh rather than stretched from the 512 px file, and no size loses quality.

| File | Size | What it is | Used by |
|---|---|---|---|
| icon.png | 1024×1024 | opaque, full bleed; iOS and Android round it themselves | app.json `icon` |
| adaptive-icon.png | 1024×1024 | transparent, the squares only at 2/3 size: Android shows the middle 72 of 108 dp, so it reads as icon.png does, and the squares stay inside the 66 dp safe circle | app.json `android.adaptiveIcon` (background `#FAFBF6`, the tile's colour) |
| splash-mark.png | 1024×1024 | transparent, the tile as drawn | app.json's splash (104 dp) and `BrandMark` (splash, onboarding) |
| favicon.png | 48×48 | transparent, the tile as drawn | app.json `web.favicon` |

To change the logo, put the new file in as `logo.png`, trace it into `logo.svg`, run `npm run export:logo`, and keep
app.json's adaptive background on the tile's colour.

`services/`, `health/` and `shopping/` hold card and category photos; their sources are in each folder's CREDITS.md.
