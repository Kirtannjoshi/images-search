# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning (where applicable).

## [0.1.0] - 2025-08-13
### Added
- Server-side image crawler API aggregating Google, Bing, and Unsplash (axios + cheerio).
- Express static server to serve the web app locally.
- Local CORS proxy (cors-anywhere) for cross-origin fetches and image downloads.
- Client-side improvements: parallel multi-source search, debounced input, client+server caching, preloading, deduplication, and quality-based sorting.
- Modal viewer fixes with keyboard navigation (Esc, arrows) and smooth image fade-in.

### Changed
- Updated UI styles for responsiveness and performance (content-visibility, contain, aspect-ratio).
- Switched client to prefer the server API with client-side fallback.

### Fixed
- Removed adoptedStyleSheets usage that caused CSSStyleSheet errors.
- Resolved modal open/close issue; added skeleton loading indicators.

### Known / Next
- Optional API keys for Unsplash/Pixabay to boost coverage.
- Add filters (size, type, source) and more providers in follow-ups.

[0.1.0]: https://github.com/Kirtannjoshi/images-search/releases/tag/v0.1.0
