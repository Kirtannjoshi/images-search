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
- GET /api/search?q=cats&safe=active

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