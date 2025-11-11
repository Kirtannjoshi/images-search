# 🔍 Image Search - Multi-Source Search Engine

A beautiful, responsive image search engine that combines results from multiple sources including Google Images and Reddit.

![Image Search Screenshot](https://via.placeholder.com/800x400/6366f1/ffffff?text=Image+Search+Engine)

## ✨ Features

- 🌐 **Multi-source search** - Google Images + Reddit + more
- 🎨 **Beautiful UI** - Modern, responsive design
- 📱 **Mobile-friendly** - Works on all devices
- 🖼️ **Image modal** - Click to enlarge with download/share
- 🏷️ **Source attribution** - Click badge to visit original source
- 📄 **Pagination** - Browse multiple pages of results
- ⚡ **Fast loading** - Skeleton loaders and caching
- 🎯 **Accurate results** - Real character-specific images

## 🚀 Live Demo

**Visit**: [https://kirtannjoshi.github.io/images-search/](https://kirtannjoshi.github.io/images-search/)

Try searching for:
- "thor"
- "marvel wallpaper"
- "nature landscape"
- "abstract art"

## 🛠️ Local Development

### Requirements
- Node.js 14+
- npm

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kirtannjoshi/images-search.git
   cd images-search
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the servers**
   ```bash
   # Option 1: Use the startup script
   START.bat

   # Option 2: Manual start
   # Terminal 1: API Server
   node api-server.js
   
   # Terminal 2: Frontend
   node server.js
   ```

4. **Open browser**
   ```
   http://localhost:8080
   ```

## 🏗️ Architecture

### Local Development
```
Browser (localhost:8080)
    ↓
REST API (localhost:3000)
    ↓
├─ Google Images Scraping (90+ results)
├─ Reddit API (15-25 results)
└─ Free APIs (Unsplash, Pexels, etc.)
```

### GitHub Pages
```
Browser (GitHub Pages)
    ↓
├─ Reddit API (15-25 results)
├─ Unsplash API (10-15 results)
├─ Pexels API (10-15 results)
├─ Pixabay API (10-15 results)
├─ Wikimedia Commons (5-10 results)
└─ Openverse API (5-10 results)
```

## 📊 Results Comparison

| Platform | Google | Reddit | Others | Total |
|----------|--------|--------|--------|-------|
| **Localhost** | 90+ | 15-25 | N/A | ~40 images |
| **GitHub Pages** | N/A | 15-25 | 30-40 | ~30 images |

**Why Google doesn't work on GitHub Pages?**
- GitHub Pages only hosts static files
- Google Images scraping requires a backend server
- Solution: Run locally for Google results, or use GitHub Pages for public access

## 🎨 Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js, Express
- **APIs**: Reddit, Unsplash, Pexels, Pixabay, Wikimedia, Openverse
- **Scraping**: Axios, Cheerio
- **Hosting**: GitHub Pages (frontend), localhost (full features)

## 📁 Project Structure

```
images-search/
├── index.html          # Main UI
├── script.js           # Frontend logic
├── styles.css          # Styles
├── api-server.js       # REST API backend
├── server.js           # Static + CORS proxy server
├── package.json        # Dependencies
├── START.bat           # Easy local startup
├── DEPLOY.bat          # Easy deployment
└── README.md           # This file
```

## 🔧 Configuration

The app automatically detects the environment:

```javascript
// Auto-detect localhost vs production
const USE_REST_API = window.location.hostname === 'localhost';
```

- **Localhost**: Uses REST API with Google scraping
- **GitHub Pages**: Uses free APIs only

No code changes needed! 🎉

## 🌟 Sources

### Working on Localhost:
- ✅ **Google Images** - 90+ results via server-side scraping
- ✅ **Reddit** - 15-25 results via JSON API

### Working on GitHub Pages:
- ✅ **Reddit** - 15-25 results
- ✅ **Unsplash** - 10-15 results
- ✅ **Pexels** - 10-15 results
- ✅ **Pixabay** - 10-15 results
- ✅ **Wikimedia Commons** - 5-10 results
- ✅ **Openverse** - 5-10 results

## 📝 Usage Examples

### Search for specific topics
```javascript
// Search for Thor
http://localhost:8080/?q=thor

// Search for Marvel wallpapers
http://localhost:8080/?q=marvel+wallpaper
```

### Use REST API directly (localhost)
```bash
# Search via API
curl "http://localhost:3000/api/search?q=thor&page=1&sources=all"

# Health check
curl "http://localhost:3000/health"
```

## 🚀 Deployment

### To GitHub Pages

1. **Run deployment script**
   ```bash
   DEPLOY.bat
   ```

2. **Or manually**
   ```bash
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin master
   ```

3. **Enable GitHub Pages**
   - Go to repository Settings
   - Click Pages (sidebar)
   - Select `master` branch
   - Save

4. **Access your site**
   ```
   https://kirtannjoshi.github.io/images-search/
   ```

## 🐛 Troubleshooting

### Images not loading?
- Check browser console for CORS errors
- Verify API keys (if using)
- Clear cache and hard refresh (Ctrl + Shift + R)

### API server not starting?
- Check if port 3000 is already in use
- Kill existing node processes: `taskkill /F /IM node.exe`
- Restart with `START.bat`

### GitHub Pages not updating?
- Wait 1-2 minutes for rebuild
- Clear GitHub Pages cache in Settings
- Verify `index.html` is in root folder

## 📜 License

MIT License - feel free to use for any purpose!

## 👤 Author

**Kirtan Joshi**
- GitHub: [@Kirtannjoshi](https://github.com/Kirtannjoshi)

## 🙏 Acknowledgments

- Google Images
- Reddit API
- Unsplash API
- Pexels API
- Pixabay API
- Wikimedia Commons
- Openverse

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Kirtannjoshi/images-search/issues)
- **Documentation**: See `DEPLOY.md` and `FINAL-STATUS.md`

---

⭐ **Star this repo** if you found it helpful!

Made with ❤️ by Kirtan Joshi
