# AFAQ style for image AIs (Gemini "Nano Banana", ChatGPT image / GPT-Image, Midjourney, Firefly)

Image models don't load fonts, can't use exact hex codes perfectly, and often misspell text. Get the best result like this:

## 1. Always attach references
Upload 2–4 images from the brand kit with your prompt:
- 1–2 samples from `/brand/samples/` (e.g. open-week-poster.webp, wifi-poster.webp, slide-welcome.webp) → the style
- the logo `/brand/logo/png/afaq-mark-white-1024.png` (or navy) → so it's not redrawn wrong
- `/brand/palette.png` → the colours
Then say: "Use the attached images as the style reference. Match the style exactly."
(Nano Banana is very good at following reference images and at editing an existing image — use that.)

## 2. Style block (paste at the start of every prompt)
```
Style: retro 8-bit pixel-art computer interface, flat graphic design, crisp pixel edges.
Background: electric royal blue (#233DFF) with a thin white square grid (54 px cells, faint).
Colours only: navy #050A30, royal blue #233DFF, sky blue #5CBCF9, pale blue #CAE8FF, white; small accents of gold #FFC531 or pink #FF4F7B.
Shapes: square corners, thick navy outlines, hard offset drop shadows with no blur (navy then sky blue), pixel "staircase" edges between colour zones, retro app windows with a navy title bar and three small coloured squares, a white pixel mouse cursor.
Typography: chunky blocky pixel font for titles, white letters with stacked navy and sky-blue offset shadows; clean bold sans-serif for small text.
No gradients, no glow, no 3D, no rounded corners, no emoji, no photorealism (unless a photo is requested), no extra logos.
```

## 3. Recipe prompts (replace the [brackets])
**Instagram post 4:5**
```
[Style block]
Create a 4:5 vertical Instagram post (1080×1350) for AFAQ Scientific Club.
Big pixel title at the top-left: "[TITLE]". Under it a small gold tag that says "[TAG]".
In the middle, a tilted retro pixel app window titled "[NAME].EXE" showing a pixel-art [OBJECT].
Bottom: a navy strip with the text "@afaq_scientific_club". Put the attached AFAQ logo in a small white square at the bottom-right.
Leave clean empty space for: [Date · Place] (I will add it later).
```
**Story 9:16** — same, "9:16 vertical story (1080×1920)", title in the upper third, logo at the top.
**Poster A4** — same, "A4 portrait poster", add "a white information card with a navy border and hard blue shadow, left empty".
**Photo post** — attach the photo: "Keep this photo unchanged. Add a dark navy fade at the bottom, a big white title '[TITLE]' bottom-left, a small sky-blue pixel kicker above it '[KICKER]', and a thin pixel strip of blue and light-blue blocks along the bottom edge. Minimal."
**Pixel icon / sticker** — "Single pixel-art icon of a [OBJECT], 16×16 pixel grid look, navy outline, royal blue and pale blue fill, transparent/white background, crisp pixels."
**Edit an existing design** (Nano Banana) — attach the design: "Keep everything the same, only change the title to '[NEW TITLE]'" / "Make a version with a [purple] background, same layout."

## 4. Text tips
- Keep words short (1–4 words per line) and put exact text in quotes.
- Arabic text is often wrong in image models: generate the design WITHOUT the Arabic line, then add it yourself in Canva/Photoshop with Thmanyah Sans.
- Dates, places, QR codes: always add them yourself afterwards (never let the AI make a QR — it won't scan).
- Best workflow: let the AI make the artwork/background, then put the final text and logo on top in Canva/Photoshop using the brand fonts — or use the HTML method in AFAQ-design-system-PORTABLE.md for pixel-perfect results.
