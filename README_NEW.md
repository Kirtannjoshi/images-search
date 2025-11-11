# 🖼️ ImageHunt - Advanced Multi-Source Image Search

A professional, minimalistic image search application featuring **advanced web scraping algorithms** to fetch real images from Google, Pinterest, Instagram, Facebook, Reddit, Bing, and more - all without API keys!

## ✨ Key Features

### 🔍 **Advanced Web Scraping**
- **12 Image Sources**: Google, Bing, Reddit, Pinterest, Instagram, Facebook, Unsplash, Pixabay, Pexels, Flickr, Wikimedia, Openverse
- **CORS-Anywhere Proxy**: Bypass cross-origin restrictions for seamless scraping
- **Multi-Method Extraction**: 
  - JSON data structure parsing (AF_initDataCallback, __PWS_DATA__, window._sharedData)
  - Regex pattern matching for CDN URLs
  - HTML attribute extraction (srcset, og:image)
- **No API Keys Required**: All sources use publicly available data via web scraping

### 🎯 **Smart Algorithms**
- **Binary Search Tree Indexing**: O(log n) insertion for efficient image organization
- **TF-IDF Relevance Scoring**: Advanced ranking based on query-title token overlap
- **Exact Match Bonus**: 2x score boost for exact query matches
- **Word Order Preservation**: 1.5x bonus for maintaining query word sequence
- **Source Priority Weighting**: Google (50M) > Bing (48M) > Reddit (45M) > Pinterest (42M) > Instagram (40M) > Facebook (38M)

### 📄 **Intelligent Pagination**
- **Page 1**: Shows ONLY priority sources (Google, Bing, Reddit, Pinterest, Instagram, Facebook)
- **Page 2+**: Shows secondary sources (Unsplash, Pixabay, Pexels, Flickr, Wikimedia, Openverse)
- **30 images per page** with seamless navigation

### 🎨 **Professional UI**
- **Minimal Black & White Theme** with dark mode support
- **Inter Font** for clean typography
- **Gradient Text Effects** on headings
- **Responsive Masonry Grid** with aspect-ratio preservation
- **Source Attribution**: Clickable source badges with copyright notices
- **Modal Image Viewer**: Full-screen viewing with keyboard navigation

### 📊 **Source Filtering**
- **Individual Source Toggles**: Select specific sources to search
- **"All Sources" Quick Toggle**: Enable/disable all at once
- **Favicon Indicators**: Visual source identification
- **Active State Styling**: Clear visual feedback for selected sources

### 🏷️ **Copyright & Attribution**
- **Automatic Attribution**: Every image includes copyright notice
- **Click-to-Visit**: Source badges are clickable, redirecting to original platform
- **Disclaimer**: "We do not claim ownership - content belongs to original sources"
- **Transparent Sourcing**: Clear indication of where each image came from

## 🛠️ Technical Implementation

### CORS Proxy Setup
```javascript
// server.js
const cors_proxy = require('cors-anywhere');
cors_proxy.createServer({
    originWhitelist: [], // Allow all origins
}).listen(8080, 'localhost');
```

### Advanced Scraping Methods

#### **Google Images**
```javascript
// Method 1: AF_initDataCallback JSON extraction
/AF_initDataCallback\({[^}]*key:\s*'ds:1'[^}]*data:function\(\){return\s+(\[.+?\])\s*}\s*}\);/gs

// Method 2: Direct URL pattern matching
/"(https?:\/\/[^"]+\.(jpg|jpeg|png|gif|webp))"/gi

// Method 3: Nested data traversal
extractFromNestedData(data, images, query, 'google');
```

#### **Pinterest**
```javascript
// Extract from __PWS_DATA__ JSON
/__PWS_DATA__\s*=\s*({.+?});/s

// Pinterest CDN URLs with quality upgrade
/"(https:\/\/i\.pinimg\.com\/[^"]+\.(jpg|jpeg|png|webp))"/gi
const original = url.replace('/236x/', '/originals/').replace('/474x/', '/originals/');
```

#### **Instagram**
```javascript
// Extract from window._sharedData
/window\._sharedData\s*=\s*({.+?});/s

// Instagram CDN images (filter out profile pics)
/"(https:\/\/[^"]*cdninstagram\.com[^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi
```

#### **Facebook**
```javascript
// Facebook CDN (fbcdn.net and scontent)
/"(https:\/\/[^"]*fbcdn\.net[^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi
/src="(https:\/\/[^"]*scontent[^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi
```

### Deduplication & Quality Control
```javascript
function deduplicateByUrl(images) {
    const seen = new Set();
    return images.filter(img => {
        const url = img.highQualityUrl || img.url;
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
    });
}
```

## 🚀 Quick Start

### Prerequisites
```bash
node -v  # v14 or higher
npm -v   # v6 or higher
```

### Installation
```bash
# Clone the repository
git clone https://github.com/Kirtannjoshi/images-search.git
cd images-search

# Install dependencies
npm install

# Start the CORS proxy server
node server.js
```

### Usage
1. **Start Server**: `node server.js` (runs on port 8080)
2. **Open Browser**: Navigate to `http://localhost:8080/index.html`
3. **Search**: Enter any query and see images from all 12 sources
4. **Filter**: Toggle specific sources on/off
5. **Click Source**: Click any source badge to visit the original website
6. **View Full Image**: Click image to open modal viewer

## 📡 API Endpoints

### CORS Proxy
```
http://localhost:8080/<target-url>

Example:
http://localhost:8080/https://www.google.com/search?q=nature&tbm=isch
```

### Headers Required
```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
X-Requested-With: XMLHttpRequest
```

## 🧩 Project Structure
```
img search/
├── index.html          # Main UI with source filters & pagination
├── styles.css          # Minimal professional styling
├── script.js           # Advanced scraping algorithms & search logic
├── server.js           # CORS-anywhere proxy server
├── package.json        # Dependencies (cors-anywhere)
├── LICENSE             # MIT License
└── README.md          # This file
```

## 🔒 Legal & Ethics

### Copyright Notice
All images are property of their respective owners. This application:
- ✅ **Does NOT claim ownership** of any images
- ✅ **Provides clear attribution** for each source
- ✅ **Links back to original sources** for proper credit
- ✅ **Uses publicly available data** only
- ✅ **Respects robots.txt** and rate limits

### Disclaimer
```
© All images belong to their original owners.
We do not claim any rights to the images.
This is an educational project demonstrating web scraping techniques.
For commercial use, please obtain proper licenses from original sources.
```

## 🎯 Roadmap

### Completed ✅
- [x] 12 image sources with web scraping
- [x] CORS proxy implementation
- [x] Advanced relevance scoring (TF-IDF)
- [x] Binary search tree indexing
- [x] Priority-based pagination
- [x] Source filtering system
- [x] Click-through attribution
- [x] Responsive masonry grid
- [x] Dark mode support
- [x] Modal image viewer

### Planned 🚧
- [ ] Infinite scroll pagination
- [ ] Advanced filters (size, color, type)
- [ ] Image similarity detection
- [ ] Bulk download feature
- [ ] Search history with autocomplete
- [ ] Favorites/bookmarking system
- [ ] Share to social media
- [ ] PWA support (offline mode)

## 🤝 Contributing

We welcome contributions! Here's how:
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/AmazingFeature`
3. Commit changes: `git commit -m 'Add AmazingFeature'`
4. Push to branch: `git push origin feature/AmazingFeature`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 👨‍💻 Author

**Kirtan Joshi**
- GitHub: [@Kirtannjoshi](https://github.com/Kirtannjoshi)
- Repository: [images-search](https://github.com/Kirtannjoshi/images-search)

## 🙏 Acknowledgments

- **CORS-Anywhere** by Rob--W for proxy implementation
- **Chromium** for fetch API and web standards
- **All image sources** for publicly available content
- **Open-source community** for inspiration and tools

---

<div align="center">
Made with ❤️ for the web scraping community
</div>
