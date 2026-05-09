# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Source for the personal site hosted at https://demitard.nekoweb.org. It is a fully static site — plain HTML, CSS, and vanilla JavaScript with no build step, no package manager, and no framework. Files are deployed to Nekoweb as-is.

## Local development

There is no build/lint/test tooling. To preview, serve the repo root with any static server, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Opening files via `file://` may break `fetch` calls (Discord status) due to CORS.

## Structure & architecture

The site is page-based: each top-level `*.html` file is a standalone entry point that pulls in only the CSS and JS it needs.

- `index.html` — landing page; embeds the Discord status widget and links to utilities.
- `sort.html` + `scripts/sortVisualizer.js` + `css/sort.css` — sorting algorithm visualizer with audio (multiple algorithms incl. pancake sort).
- `sticker.html` + `scripts/stickerMaker.js` + `css/sticker.css` — image cropper with custom aspect ratios (despite the filename, the user-facing feature is "Image Cropper").
- `not_found.html` — 404 page.
- `css/` — one stylesheet per UI section (`header`, `footer`, `welcome`, `about-me`, `information`, `discord-status`, `utilities`) plus per-page styles. `styles.css` is the shared base loaded by `index.html`.
- `elements/` — image assets.

### Discord status widget

`scripts/discordStatus.js` calls the public Lanyard API (`https://api.lanyard.rest/v1/users/<id>`) and renders username, status, and current activities into `#discord-status`. The user ID is passed inline from `index.html` via `displayUserInfo('391344552817983498')`. The script must be loaded before the inline call site (currently included in `<head>` before `<body>` runs the call).

### JS conventions

Scripts use `/* jshint esversion: 11 */` directives at the top for ES2020 compatibility hints. No modules, no bundler — scripts are loaded directly via `<script src=...>` and rely on globals.

## Adding a new utility page

The pattern used by `sort.html` and `sticker.html`:
1. Create `<name>.html` at repo root, link `css/styles.css` plus a page-specific `css/<name>.css`, and include `scripts/<name>.js`.
2. Add a `<a class="utility-card">` entry to the `.utility-grid` in `index.html`.
