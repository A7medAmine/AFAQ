Here's the OpenCode prompt:

---

````
Redesign the HeroSection.jsx component in this React project to match this reference design exactly.

## Reference Design Description
Hero section for "AFAQ Scientific Club" — a robotics/electronics university club.

Split layout:
- LEFT: text content
- RIGHT: floating 3D asset images over a blue star/swoosh shape

---

## PROJECT CONTEXT (preserve everything below)
- Vite + React project
- Tailwind CSS for styling
- i18n via react-i18next — use `useTranslation('home')` hook, keys already exist in src/locales/
- Shared components: Button.jsx, Logo.jsx, StatCard.jsx from src/components/shared/
- Navbar.jsx is in src/components/layout/ — redesign it too
- No framer-motion installed — use CSS animations only (keyframes in index.css or inline style)
- Font: 'KOMediaBlack.otf' is available in /public/fonts/ — use it for the H1 headline only
- Theme: ThemeContext exists — respect dark/light if already wired, otherwise default to light

---

## NAVBAR REDESIGN (src/components/layout/Navbar.jsx)
Keep all existing logic (mobile menu, language switcher, theme toggle, routing).
Only change the visual style:

- Background: white, border-bottom: 1px solid #E2E8F0, backdrop-blur on scroll
- Logo: use existing <Logo /> component, keep as-is
- Nav links: font-medium text-slate-700, hover:text-blue-600, active link gets text-blue-600 + underline
- "Join Us" CTA button → bg-[#0F172A] text-white rounded-2xl px-6 py-2.5 font-semibold hover:bg-blue-700 transition
- Keep LanguageSwitcher and ThemeToggle in their current positions

---

## HEROSECTION REDESIGN (src/components/home/HeroSection.jsx)

### Overall layout
```jsx
<section className="min-h-screen bg-[#EEF2FF] flex flex-col">
  <div className="flex flex-1 px-8 lg:px-16 gap-8 items-center max-w-7xl mx-auto w-full py-20">
    <HeroLeft />   {/* flex-1 */}
    <HeroRight />  {/* flex-1 */}
  </div>
  <StatsBar />
</section>
````

Split into sub-components inside the same file (no new files needed).

---

### HeroLeft

```
- Eyebrow text: t('hero.eyebrow') — uppercase, text-blue-500, tracking-widest, text-sm font-semibold
- H1 (use KOMediaBlack font via className="font-ko-black"):
    Line 1: t('hero.line1') → text-[#0F172A]
    Line 2: t('hero.line2') → text-[#0F172A]
    Line 3: first word → text-blue-500, rest → text-[#0F172A]
  Font size: text-6xl lg:text-7xl, leading-tight
- Subtitle: t('hero.subtitle') — text-slate-500 text-lg leading-relaxed
  Last two words highlighted in text-blue-500 (wrap in <span>)
- Buttons (mt-8 flex gap-4 flex-wrap):
    <Button variant="primary">t('hero.cta_primary') + →</Button>
    <Button variant="outline">t('hero.cta_secondary') + 🗓</Button>
  Style Button.jsx variants if not already:
    primary → bg-[#0F172A] text-white rounded-2xl px-7 py-3.5
    outline → bg-white border-2 border-[#0F172A] text-[#0F172A] rounded-2xl px-7 py-3.5

Animate: add CSS class "hero-fade-up" with staggered animation-delay on each child element.
Add to index.css:
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}
.hero-fade-up { animation: fadeUp 0.7s ease forwards; }
```

---

### HeroRight

```
Relative container: relative h-[520px] lg:h-[600px] w-full

Layer 1 — Blue star SVG (absolute, centered, z-0):
Render an inline SVG star/polygon shape:
<svg viewBox="0 0 500 500" className="absolute inset-0 w-full h-full z-0">
  <polygon
    points="250,30 310,180 470,180 340,270 390,430 250,340 110,430 160,270 30,180 190,180"
    fill="#3B82F6" opacity="0.85"
  />
</svg>

Layer 2 — Floating images (absolute, z-10):
Use <img> tags with src from /public/images/:
  arduino.png   → className="absolute top-[5%] left-[15%] w-56 lg:w-64 -rotate-6 float-asset"
  robocar.png   → className="absolute bottom-[5%] right-[-5%] w-72 lg:w-80 rotate-3 float-asset"
  breadboard.png → className="absolute bottom-[25%] left-[5%] w-44 lg:w-52 -rotate-3 float-asset"

All images: style={{ filter: 'drop-shadow(0 20px 40px rgba(59,130,246,0.4))' }}

Add to index.css:
@keyframes floatY {
  0%, 100% { transform: translateY(0px) var(--rotate); }
  50%       { transform: translateY(-12px) var(--rotate); }
}
.float-asset { animation: floatY 3.5s ease-in-out infinite; }
.float-asset:nth-child(2) { animation-delay: 0.5s; }
.float-asset:nth-child(3) { animation-delay: 1s; }

Layer 3 — Pill badges (absolute, z-20):
White bg, shadow-lg, rounded-full, flex items-center gap-2, px-4 py-2, text-sm font-semibold text-slate-800

Badge component (inline):
const Badge = ({ icon, label, className }) => (
  <div className={`absolute bg-white rounded-full shadow-lg flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-800 z-20 ${className}`}>
    <span>{icon}</span>{label}
  </div>
)

Place badges:
<Badge icon="</>" label="Arduino"     className="top-[8%] right-[5%]" />
<Badge icon="🤖"  label="Robotics"   className="top-[48%] left-[0%]" />
<Badge icon="🔌"  label="Electronics" className="bottom-[12%] right-[8%]" />

Layer 4 — Floating icon circles (z-20, absolute):
Small white circle (w-10 h-10 rounded-full shadow-md flex items-center justify-center)
💡 → top-[22%] left-[3%]
🚀 → top-[8%] right-[28%]
👥 → bottom-[42%] left-[32%]

Background dots: scatter 10–12 small divs (w-2 h-2 bg-blue-400 rounded-full opacity-30) with absolute positioning at various coordinates for depth.
```

---

### StatsBar

```
Full-width, bg-[#F1F5F9], border-t border-slate-200, py-8

Use existing <StatCard /> component if it exists, or render:
4 columns in flex row, each separated by border-r border-slate-200:

  Icon (text-blue-500 text-2xl) | Bold number (text-4xl font-bold text-[#0F172A]) | Label (text-slate-500 text-sm)

Stats data (hardcode for now, replace with t() keys later):
  { icon: '👥', number: '300+', label: 'Active Members' }
  { icon: '🛠️', number: '30+',  label: 'Workshops' }
  { icon: '🚀', number: '25+',  label: 'Projects' }
  { icon: '🏆', number: '10+',  label: 'Competitions' }

Add count-up animation using IntersectionObserver + useState (vanilla, no library).
```

---

## FONT SETUP

In tailwind.config.js, add:

```js
theme: {
  extend: {
    fontFamily: {
      'ko-black': ['KOMediaBlack', 'sans-serif'],
    }
  }
}
```

In index.css, add:

```css
@font-face {
  font-family: "KOMediaBlack";
  src: url("/fonts/") format("opentype");
  font-weight: 900;
  font-display: swap;
}
```

---

## IMAGE PLACEHOLDERS

Until real assets arrive, use colored divs:

```jsx
// arduino.png not found → fallback
<div className="w-64 h-40 bg-blue-100 rounded-2xl border-2 border-blue-200 flex items-center justify-center text-blue-400 text-sm">
  Arduino
</div>
```

Use onError on <img> to swap to fallback div.

---

## DO NOT TOUCH

- src/contexts/ThemeContext.jsx
- src/i18n/config.js
- src/lib/supabase.js
- src/data/index.js
- Any page files other than indirectly via HeroSection
- Any component outside home/ and layout/

```

```
