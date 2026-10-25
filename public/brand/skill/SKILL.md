---
name: "afaq-design-system"
description: "Use for ANY AFAQ Scientific Club design (posters, social posts, story/post frames, badges, flyers, brochures, project sheets, banners) to keep the club's pixel/retro blue design system."
---

# AFAQ design system (always apply)

Every AFAQ design must look like it belongs to the same family as the existing AFAQ canvas: a **retro pixel / 8-bit computer** look on a **blue grid**, with **hard offset shadows**, the **Minecraft pixel font** for titles and **Thmanyah Sans** for body text. Never switch to a different style (no soft gradients as the main look, no glassmorphism, no rounded cards, no emoji, no stock "AI" look), even if a reference image uses one. When the user sends a reference (e.g. a Photoshop draft), keep its *content and composition idea* and rebuild it in this system.

## Where designs live
- Canvas (Claude Design artifact): https://claude.ai/artifact/Lwq55E8c5b4Keeu1nYtv5u — always add new designs here as new artboards; never create a new canvas, never overwrite an existing artboard unless asked ("make a copy" = new artboard).
- The canvas has pages: `main` ("Posters, print & badges") and `social` ("Social media frames"). Social posts/frames/stories go on `page: "social"`.
- Before publishing: re-read `project/canvas.json` and any artboard you edit (the user edits by hand). Add a `boards` entry + `order` slot for each new artboard, and a `title1` note ≥223 px above its row. Leave 80 px between frames in a row and ~120+ px between rows. Find free space by computing the max y of boards on the same page.

## Colors (exact)
| Token | Hex | Use |
|---|---|---|
| Navy (ink) | `#050A30` | text, borders, dark backgrounds, shadows |
| AFAQ Blue | `#233DFF` | main background, primary |
| Sky accent | `#5CBCF9` | 2nd shadow layer, highlights (the `{{accent}}` prop default) |
| Light blue | `#CAE8FF` | soft fills, sub-text on dark |
| Grey text | `#3C4C59` | body text on white |
| White | `#FFFFFF` | cards, titles on blue |

Team / fun accents (use sparingly, only when color is asked for or for team coding): pink `#FF4F7B`, orange `#FF9F1C`, green `#20C997`, purple `#7C5CFF`, cyan `#00B4D8`, gold `#FFC531`, silver `#C0CCDA`.
Team colors: Media pink, Logistics orange, Tech green, Linguistics purple, Relex cyan, Vice President silver, President gold.
No rainbow stripes. Default deliverable = blue version; offer colorful/navy variants as extra artboards.

## Fonts
The club fonts are not on Google Fonts or any public CDN. They are self-hosted on the club site and bundled with this skill. Never substitute another font (no Press Start 2P, VT323, Cairo, Tajawal…); if the real font cannot be loaded, stop and say so.

**Hosted fonts (direct links):**
- Stylesheet with every family: https://afaq.club/brand/fonts/afaq-fonts.css
- Single files: https://afaq.club/brand/fonts/Minecraft.woff2, https://afaq.club/brand/fonts/thmanyahsans-Bold.woff2 (pattern `https://afaq.club/brand/fonts/<file>`; every family also has `.ttf`)
- Install packs (.ttf): https://afaq.club/brand/fonts/zip/minecraft.zip, https://afaq.club/brand/fonts/zip/thmanyah-sans.zip, https://afaq.club/brand/fonts/zip/thmanyah-serif-display.zip, https://afaq.club/brand/fonts/zip/unixel.zip

Families:
- **Minecraft** (400): titles, kickers, labels, tags, numbers, window titles (UPPERCASE). Latin only.
- **Thmanyah Sans** (300/400/500/700/900): body text and all Arabic (`dir="rtl"`). Use 500/700/900 in designs.
- **Thmanyah Serif Display** (300–900): optional editorial Arabic headlines.
- **Unixel** (400): optional pixel-style Arabic headlines.

Pick the source by where the design is rendered:

1. **Claude Design canvas** (the artifact below) — use the canvas blobs in `<helmet>` exactly; artifacts block external stylesheets:
   ```
   @font-face{font-family:"Minecraft";src:url("/_blob/2e41989df288d570edbe07467f1dd0a8") format("woff2");font-display:block}
   @font-face{font-family:"Thmanyah Sans";src:url("/_blob/d86926c9fef2545b535af2af10d350fa") format("woff2");font-weight:500}
   @font-face{font-family:"Thmanyah Sans";src:url("/_blob/df869c9198d1c9661760835d3c3ebb33") format("woff2");font-weight:700}
   @font-face{font-family:"Thmanyah Sans";src:url("/_blob/9d515cf4bbb3bc24bcf671d76c692a38") format("woff2");font-weight:900}
   ```
   Need a weight or family that has no blob yet (or working in a new artifact)? Upload the file from the skill's `fonts/` folder (or download it from `https://afaq.club/brand/fonts/<file>`) with the Artifact asset upload, then reference the returned URL in a new `@font-face`. Add the new blob URL to this list.
2. **Any other HTML** (local Playwright render, standalone page, email preview, slides): one line in `<head>`:
   ```html
   <link rel="stylesheet" href="https://afaq.club/brand/fonts/afaq-fonts.css">
   ```
   Files are also reachable one by one (CORS open): `https://afaq.club/brand/fonts/Minecraft.woff2`, `thmanyahsans-Medium.woff2`, `thmanyahsans-Bold.woff2`, `thmanyahsans-Black.woff2`, `thmanyahserifdisplay-Bold.woff2`, `unixel-Regular.ttf` (every family also has `.ttf`).
3. **Offline / no network**: use the bundled copies next to this file — `<link rel="stylesheet" href="<skill dir>/fonts/afaq-fonts.css">` (paths inside are relative), or copy the needed `.woff2` files beside the HTML.
4. **Desktop apps / Canva / Figma**: install or upload the `.ttf` files from `fonts/` (or https://afaq.club/brand). Do not let the tool fall back to a default font.

Before exporting, confirm the fonts actually loaded: in a browser render, `await document.fonts.ready` then check `document.fonts.check('16px "Minecraft"')` and `document.fonts.check('700 16px "Thmanyah Sans"')` are `true`.

## Assets (canvas blobs)
- AFAQ logo (lightning mark): `/_blob/7ca69d8ea08c869a859168779b979958`
- Dotted logo pattern (big faint background mark): `/_blob/2b5c1c5f17454dd2d757e97a39244d00` (use at opacity .12–.22, white via `filter: brightness(0) invert(1)` on blue)
- Université de Bouira logo: `/_blob/10062ce209297e54f6e4fd6c1a4aa83f`
- Register QR (afaq.club/register): `/_blob/62bfa9cb2f56e8f26efbfbd3af73e6c9`
- New QR codes: generate with segno (navy `#050a30` modules, transparent light, border 1, `viewBox` svg with `shape-rendering="crispEdges"`), upload with the Artifact asset upload, and verify by rendering + decoding with pyzbar before publishing.

## Signature building blocks
- **Grid backgrounds**
  - Blue: `background-color:#233DFF; background-image:linear-gradient(rgba(255,255,255,0.10) 2px,transparent 2px),linear-gradient(90deg,rgba(255,255,255,0.10) 2px,transparent 2px); background-size:54px 54px`
  - White: `#FFFFFF` with `rgba(35,61,255,0.06)` lines, 54px
  - Navy: `#050A30` with `rgba(92,188,249,0.13)` lines, 54px
- **Pixel staircase edge** between two zones: a row of 20 × 54px blocks alternating 0/18px height in the upper zone's color.
- **Hard offset shadows** (no blur): cards `box-shadow: 8px 8px 0 #233DFF, 15px 15px 0 #5CBCF9`; on blue use `10px 10px 0 #050A30, 18px 18px 0 #5CBCF9`. Borders 3–6px solid navy. Square corners only.
- **Big pixel title**: Minecraft, white, `text-shadow: 4px 4px 0 #050A30, 8px 8px 0 #050A30, 14px 14px 0 #5CBCF9` (scale offsets with size).
- **Kicker**: 14px square (white/blue with 3px accent shadow) + Minecraft 24px letter-spacing .08em.
- **Pixel window**: navy title bar with Minecraft `NAME.EXE` + three 12–18px squares (pink/gold/green), white or light-blue body; optional slight rotation (±3–9°).
- **Pixel cursor** SVG (13×19 grid, white fill navy stroke) as a playful detail.
- **Pixel icons**: 16×16 grids drawn as SVG `<rect>`s with `shape-rendering="crispEdges"` (camera, house, car, RFID, game console, saber, flag, wifi…). Never use emoji or brand logos (no Photoshop/Instagram logos) — draw a generic pixel equivalent.
- **Chips / tags**: Minecraft text on accent or gold fill, 3–4px navy border, 4–6px navy hard shadow.
- **Footer band**: navy bar with `AFAQ SCIENTIFIC CLUB` (Minecraft) · `@afaq_scientific_club · afaq.club`.
- **Logo lockup**: white square tile with logo + "AFAQ" (Minecraft) / "Scientific club" (Thmanyah 500).
- **Photo slots** in templates: striped light-blue box (`#EAF4FF` + 45° repeating stripes) with camera line icon and "YOUR PHOTO / Select and replace this box with your image".

## Formats
- Instagram post 1080×1350 (4:5) or 1080×1080; story 1080×1920; A4 portrait 1080×1528; A4 landscape tri-fold 2160×1528; badge 404×283 (10.7×7.5 cm); roll-up banner 850×2000.
- Root div fixed at w×h, `position:relative; overflow:hidden`; set `$preview` to the same size.

## Artboard file skeleton
Use the canvas `.dc.html` format: `<script src="./support.js"></script>` in head, `<x-dc>` with `<helmet>` (fonts above + `body{margin:0}` + `a{color:#233DFF}a:hover{color:#050A30}`), the design, then the `data-dc-script` block with `data-props='{"accent":{"editor":"color","default":"#5CBCF9","options":["#5CBCF9","#CAE8FF","#233DFF","#12229D"]},"$preview":{"width":W,"height":H}}'` and `class Component extends DCLogic { renderVals(){ return { accent: this.props.accent ?? '#5CBCF9' }; } }`. Use `{{accent}}` for the sky-accent shadow layer.

## Content rules
- Never invent facts (dates, places, prices, stats, features). Use clear placeholders: `[TOPIC]`, `[Date · Place]`, `[Caption]`.
- Real club facts to reuse: AFAQ Scientific Club, Université Akli Mohand Oulhadj — Bouira; @afaq_scientific_club; afaq.club; afaq.club@univ-bouira.dz; teams Media, Logistics, Tech, Linguistics, Relex (internal & external relations), President, Vice President.
- Project pages: afaq.club/projects/<id> (1 RFID Scanner, 2 Smart House, 3 Robot Car, 4 ESP Game Boy (joystick), 5 ESP Racer, 6 Photo Booth). Pull project details from the user or the repo README only.
- Bilingual when useful: English title + Arabic line (Thmanyah, rtl). Separate Arabic versions when asked.
- Keep text inside its box: check for overflow and overlaps.

## Workflow
1. Read the live canvas index (and any artboard you will touch).
2. Build the design(s) in the system above; for a request with a reference image, keep its layout idea, replace the style.
3. Render locally (Playwright) and look at the PNG; fix overlaps, clipped text, unreadable QR.
4. Publish to the canvas URL with only the changed files (+ index when adding boards). Report in a few lines what was added and where.
5. When asked for color variety, provide a blue default plus colorful and navy variants as separate artboards; never delete earlier versions.