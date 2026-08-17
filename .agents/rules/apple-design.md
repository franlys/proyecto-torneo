# Apple-Style Design Rules for AI-Assisted UI Coding

This rule instructs the agent on how to write, design, and style UI components following a premium, minimalist, and humanist Apple-style design system. Apply these rules when creating or updating any visual web components, pages, or widgets.

---

## 📐 1. Typography & Hierarchy
* **Font Family:** Prioritize clean, modern humanist typefaces. Use system font stack `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. For heading emphasis, fallback to Google Fonts like *Inter*, *Outfit*, or *SF Pro*.
* **Tracking & Leading:** 
  * Apply `tracking-tight` or `tracking-tighter` on headings (`h1`, `h2`, `h3`).
  * Use generous line height (`leading-relaxed` or `leading-loose`) on body text to maximize readability.
* **Contrast:** Large size contrast between headings and body text. Use bold font weights (e.g., `font-black`, `font-bold`) next to subtle, thin text (`font-normal`, `text-white/40`) to create depth.

---

## 🎨 2. Palette & Contrast
* **Dark Mode & Glassmorphism:**
  * Backgrounds should use deep, rich shades (e.g., `#0B0D12`, `#060709`) rather than flat black.
  * Use frosted glass containers (`backdrop-blur-md bg-white/[0.02] border border-white/5` or `bg-black/40 border-white/10`).
* **Accents:** 
  * Use highly curated, single-hue accents (like gold `#F59E0B`, neon cyan `#00F2FE`, or royal purple).
  * Avoid generic primary/secondary colors. Use opacity layers (e.g., `bg-neon-cyan/10 text-neon-cyan`) for pills and badges.

---

## 🖼️ 3. Layout, Grids & Spacing
* **Generous Padding:** Do not crowd elements. Use spacious layouts (`p-6 sm:p-8`, `gap-6`, `space-y-6`).
* **Sleek Geometry:** Apply `rounded-2xl` (16px) or `rounded-3xl` (24px) to cards and containers. Buttons should use pill layouts (`rounded-full`) or smooth squarish corners (`rounded-xl`).
* **Full-Bleed Media:** When displaying graphics or images, make them bleed to the edges of the card (`w-full h-full object-cover rounded-t-2xl` or full card bleed) to mimic editorial layouts.

---

## ✨ 4. Micro-animations & Interactive Elements
* **Tactile Interactions:** Add scaling effects to buttons and clickable cards.
  * Class: `transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] cursor-pointer`
* **Subtle Highlights:** Use extremely thin ring borders on hover:
  * Class: `border border-white/5 hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.02)]`
* **Smooth Transitions:** Always use `transition-all duration-300 ease-out` on color, opacity, and transform shifts.
