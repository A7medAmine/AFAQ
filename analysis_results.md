# Codebase Analysis: AFAQ Scientific Club Website

## Overview
The application is a modern web application built for the "AFAQ Scientific Club", a robotics and electronics university club (likely based in Bouira, Algeria, given the index.html description). The website features a fully responsive design, dark/light mode, internationalization (i18n), and an aesthetic, animation-rich interface.

## Tech Stack
- **Framework**: React 19 + Vite
- **Routing**: React Router DOM v7
- **Styling**: Tailwind CSS v4.3.0 + Vanilla CSS (`src/index.css`)
- **Language/i18n**: `react-i18next` with `i18next-browser-languagedetector`
- **Animations/3D**: `framer-motion` for UI transitions, and Three.js ecosystems (`@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`) for 3D elements.
- **Icons**: `lucide-react`
- **Backend/BaaS**: Supabase integration (`@supabase/supabase-js`)

## Project Structure
- `public/`: Contains static assets like fonts (`KOMediaBlack.otf`) and likely images in an `images/` subfolder.
- `src/`:
  - **`components/`**: Divided into `home/`, `layout/`, and `shared/` directories.
    - `layout/Navbar.jsx`: Implements a modern glassmorphic navigation bar with language switching, mobile drawer using framer-motion, and a "Join Us / Register" call-to-action.
    - `home/HeroSection.jsx`: A feature-rich hero component with an animated headline, CSS-animated orbit rings (`.orbit-ring`), and a responsive split layout. Includes a statistics bar with a vanilla JavaScript count-up animation (`IntersectionObserver`).
  - **`contexts/`**: `ThemeContext.jsx` for managing the app's light/dark modes.
  - **`pages/`**: Includes routes such as Home, About, Projects, Events, Gallery, Registration, and Contact.
  - **`i18n/`**: Configuration and locales for internationalization.
  - **`index.css`**: Highly customized global styles defining themes, RTL support for Arabic, custom typography, and complex CSS keyframe animations (like `orbit3d`, `floatY`, and `shimmer`).

## Key Discoveries & Implementation Status
1. **The Website Summary Prompt**: There is a `WEBSITE_SUMMARY.md` file in the root containing detailed OpenCode redesign instructions to modify the `HeroSection.jsx` and `Navbar.jsx` to match a very specific design.
2. **Current State:** Reviewing the React code in `src/components/home/HeroSection.jsx` and `src/components/layout/Navbar.jsx` shows that this redesign **has already been fully implemented**. The code perfectly aligns with the required blue star/swoosh layout, floating hardware PNGs, animated orbits, count-up stat cards, and the `KOMediaBlack` headline fonts requested in the `WEBSITE_SUMMARY.md`.
3. **Advanced CSS Patterns**: You have a very extensive `index.css` setup with advanced 3D transforms (`transform-style: preserve-3d`), custom utility classes (e.g., `.float-asset`, `.glass-card`), and strict layout control for LTR/RTL reading directions.

## Conclusion
The codebase is clean, modular, and up-to-date with modern React paradigms. We can now proceed to extend the website, optimize performance, build new pages (e.g., Projects or Events), or implement the backend logic via the Supabase integration.

Please specify what part of the application you'd like to work on next!
