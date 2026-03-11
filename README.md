![Design & AI Discoveries](og-image.png)

# Design & AI Discoveries

*A curated index of tools at the intersection of design and AI — what they are, what they're not, and how they fit your workflow.*

*26 tools · 11 categories · Updated March 2026*

[![Live](https://img.shields.io/badge/live-richpeniche.github.io%2Fdesign--ai-e8c547?style=flat-square&labelColor=1a1714)](https://richpeniche.github.io/design-ai)

---

## About

Design & AI Discoveries is a hand-picked index of 26 tools where design meets AI. Each entry includes structured metadata: what it is, what it’s not, speed advantage, best use cases, flow in steps, and maturity. The goal is to help you quickly see which tool fits your workflow — no fluff, no algorithm. It’s a static, single-file site with no framework or build step: one HTML file, served as-is.

---

## Features

- **Card grid** — Tools as cards with category and maturity tags
- **OG image thumbnails** — Preview images via [Microlink](https://microlink.io)
- **Modal detail view** — Click a card to open full tool info; prev/next and Esc to close
- **Filters** — Category and maturity filters in a sticky bar
- **Responsive layout** — Works on desktop and mobile
- **Fade-in images** — OG thumbnails load with a subtle animation
- **SEO** — Open Graph meta, Twitter card, inline SVG favicon, `robots.txt`, `agents.txt`

---

## Categories

- Figma Ecosystem
- Design-to-Code
- Vibe-Code / Builders
- AI Visual Generation
- UI Components & Systems
- AI Design Skills
- Product Discovery & Analytics
- Web Publishing
- Presentations
- Marketing & Brand
- Color & Tokens

---

## Stack

| Tool | Purpose |
|------|---------|
| Claude | Research, writing, code generation |
| Notion | Source of truth / tool database |
| Cursor | Code editing and iteration |
| GitHub Pages | Hosting |

---

## How it's built

Tools live in a Notion database as the single source of truth. That data is exported and baked into `index.html` as a static JavaScript array. GitHub Pages serves the file; there’s no build step, no API, no backend.

---

## Updating the site

1. Add or edit tools in the Notion DB.
2. Re-export data into the `TOOLS` array in `index.html`.
3. `git add . && git commit -m "Update tools" && git push`

---

## Local development

No build step. Open `index.html` directly in a browser, or run a local server:

```bash
npx serve .
```

---

## License

MIT
