# Use the AFAQ design skill with ChatGPT, Gemini and others

| File | Use it for |
|---|---|
| `AFAQ-design-system-PORTABLE.md` | Full rules for any AI that writes code (HTML/SVG): ChatGPT, Gemini, Claude, Cursor… |
| `custom-gpt-instructions.txt` | Short version (< 8000 characters) to paste into an instructions box |
| `image-model-prompts.md` | Image generators: Gemini Nano Banana, ChatGPT image, Midjourney… |
| `../SKILL.md` | The original Claude skill (uses the Claude design canvas) |

## ChatGPT — Custom GPT (best)
1. chatgpt.com > Explore GPTs > Create > Configure.
2. Name: "AFAQ Designer". Instructions: paste `custom-gpt-instructions.txt`.
3. Knowledge: upload `AFAQ-design-system-PORTABLE.md`, `image-model-prompts.md`, `palette.png`, the logo PNGs and 3–5 images from `samples/`.
4. Capabilities: turn on Canvas (to preview HTML), Code Interpreter and Image generation.
5. Ask: "Make a 4:5 post for [event]". For a pixel-perfect file ask for HTML, open it in Chrome, screenshot (or print to PDF).
No Custom GPT? Create a ChatGPT **Project**, put the same text in "Instructions" and upload the same files.

## Gemini — Gem
1. gemini.google.com > Gems > New Gem.
2. Instructions: paste `custom-gpt-instructions.txt`. Add the same knowledge files.
3. For code/HTML results use Canvas in Gemini. For images (Nano Banana) start the prompt with the style block from `image-model-prompts.md` and attach 2–3 samples + the logo.

## Anything else
Paste `AFAQ-design-system-PORTABLE.md` at the start of the chat (or into the system/instructions field) and attach the reference images.

## Fonts
The fonts are hosted on the club site (not Google Fonts). All of them load from https://afaq.club/brand/fonts/afaq-fonts.css (the site must be online). For Photoshop/Canva/Figma install the .ttf files from `fonts/`, or download them directly:
- https://afaq.club/brand/fonts/zip/minecraft.zip
- https://afaq.club/brand/fonts/zip/thmanyah-sans.zip
- https://afaq.club/brand/fonts/zip/thmanyah-serif-display.zip
- https://afaq.club/brand/fonts/zip/unixel.zip
