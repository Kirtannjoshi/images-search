# 🖼️ Image Search App

A fast, responsive image search app with a server-side crawler for more accurate results.

## 🔍 Features
- Multi-source image search (Google, Bing, Unsplash scraping)
- Server API with caching and relevance scoring
- Simple HTML/CSS/JS frontend with responsive grid
- Smooth UX: debounced search, preloading, fade-in, modal viewer with keyboard nav

## 🚀 Run locally
1. Clone the repository
   ```bash
   git clone https://github.com/Kirtannjoshi/images-search.git
   ```
2. Install dependencies and start all services
   ```bash
   npm install
   npm run dev
   ```
3. Open the app at http://localhost:3000

Services
- App: http://localhost:3000
- API: http://localhost:3001/api/search
- Proxy: http://localhost:8080/

## 🧠 API
Query endpoint
- GET /api/search?q=cats&page=1&sources=google,bing,unsplash,duckduckgo,flickr

Response shape (simplified)
```
[
  { "url": "...", "thumbnail": "...", "width": 1920, "height": 1080, "source": "google", "title": "...", "page": "..." }
]
```

## 💡 Roadmap
- Filters (size/type/source), more providers
- Optional API keys for Unsplash/Pixabay
- Infinite scrolling and dark mode

## 📁 Files
```
index.html
styles.css
script.js
server.js      # CORS proxy
api.js         # Search API (crawler)
static.js      # Static web server
```

## 🪪 License
MIT License

## 🔗 GitHub Pages + Remote API
If you host the frontend on GitHub Pages but want full aggregation (Google/Bing/… via server), deploy the API (api.js) to a host (Render, Railway, etc.), then configure the frontend to use it:

Options
- Add a meta tag in index.html: <meta name="api-base" content="https://your-api-host">.
- Or pass it in URL: https://kirtannjoshi.github.io/images-search/?api=https://your-api-host
- It’s saved in localStorage so you only need to set it once per browser.