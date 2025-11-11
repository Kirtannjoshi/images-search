# 🚀 GitHub Pages Deployment Guide

## 📋 Quick Deploy Steps

### 1. Commit and Push to GitHub

```bash
# Navigate to your project
cd "c:\Users\KIRTAN JOSHI\project\project ALpha\img search"

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Image search with Google and Reddit integration"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/Kirtannjoshi/images-search.git

# Push to master
git push -u origin master
```

### 2. Enable GitHub Pages

1. Go to your GitHub repository: https://github.com/Kirtannjoshi/images-search
2. Click **Settings** (top menu)
3. Click **Pages** (left sidebar)
4. Under **Source**, select **master** branch
5. Click **Save**
6. Wait 1-2 minutes for deployment

### 3. Access Your Live Site

Your site will be available at:
```
https://kirtannjoshi.github.io/images-search/
```

---

## ⚙️ How It Works

### Local Development (with API):
- Uses REST API backend (`api-server.js`) on port 3000
- Server-side scraping (no CORS)
- Google Images + Reddit working perfectly
- Best results!

### GitHub Pages (static only):
- No backend server (GitHub Pages = static files only)
- Uses client-side fallback sources
- Reddit (API - works!)
- Unsplash, Pexels, Pixabay (APIs - work!)
- Wikimedia, Openverse (APIs - work!)

**Note**: Google Images scraping won't work on GitHub Pages (needs backend), but you'll still get images from Reddit and other free APIs!

---

## 🎯 What Gets Deployed

### Files Included:
✅ `index.html` - Main UI
✅ `script.js` - Frontend logic (auto-detects localhost vs GitHub)
✅ `styles.css` - Styles
✅ `server.js` - CORS proxy (optional, won't run on GitHub Pages)
✅ `README.md` - Documentation

### Files Excluded (.gitignore):
❌ `node_modules/` - Dependencies (not needed for static site)
❌ `api-server.js` - Backend (can't run on GitHub Pages)
❌ `.env` - Environment variables
❌ Log files

---

## 🔧 Configuration

The frontend (`script.js`) automatically detects the environment:

```javascript
// Auto-detect: localhost vs GitHub Pages
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : null;

const USE_REST_API = window.location.hostname === 'localhost';
```

**On localhost**: Uses REST API (Google + Reddit scraping)
**On GitHub Pages**: Uses free APIs (Reddit, Unsplash, Pexels, etc.)

---

## 📊 Expected Results

### On Localhost (with API):
```
Search: "thor"
✅ Google: 90+ images (server-side scraping)
✅ Reddit: 15-20 images (API)
Total: ~40 unique images
```

### On GitHub Pages:
```
Search: "thor"
✅ Reddit: 15-20 images (API)
✅ Unsplash: 10-15 images (API)
✅ Pexels: 10-15 images (API)
✅ Wikimedia: 5-10 images (API)
Total: ~30 unique images
```

---

## 🎨 Customization

### To change the site title:
Edit `index.html` line 5:
```html
<title>Your Custom Title</title>
```

### To change sources:
Edit `script.js` to enable/disable sources in the `searchPromises` array.

---

## 🐛 Troubleshooting

### Images not loading on GitHub Pages?
- Check browser console for CORS errors
- Make sure you're using API-based sources (Reddit, Unsplash, etc.)
- Google Images scraping won't work (needs backend)

### Site not updating?
- Clear GitHub Pages cache: Settings → Pages → Re-save settings
- Hard refresh browser: Ctrl + Shift + R
- Wait 1-2 minutes for GitHub to rebuild

### 404 Error?
- Make sure GitHub Pages is enabled
- Check that `index.html` is in the root folder
- Verify branch is `master` (or `main`)

---

## 🔄 Update Workflow

```bash
# Make changes to your files
# ...

# Commit and push
git add .
git commit -m "Your update message"
git push origin master

# Wait 1-2 minutes
# GitHub Pages will automatically rebuild
```

---

## 📱 Features on GitHub Pages

✅ **Working Features**:
- Multi-source image search
- Reddit integration (API)
- Unsplash, Pexels, Pixabay (APIs)
- Wikimedia, Openverse (APIs)
- Responsive design
- Image modal viewer
- Download & share
- Pagination
- Source attribution

❌ **Not Working** (need backend):
- Google Images scraping
- Bing scraping
- Pinterest scraping
- Twitter scraping

---

## 💡 Pro Tips

### 1. Use a Custom Domain (Optional)
1. Buy a domain (e.g., `myimagesearch.com`)
2. In GitHub Pages settings, add custom domain
3. Update DNS records

### 2. Add Google Analytics
Add to `index.html` before `</head>`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR-GA-ID"></script>
```

### 3. Enable HTTPS
GitHub Pages automatically uses HTTPS!
```
https://kirtannjoshi.github.io/images-search/
```

---

## 📞 Support

- **Repository**: https://github.com/Kirtannjoshi/images-search
- **Issues**: Report bugs in GitHub Issues
- **Local Testing**: Run `node server.js` and visit http://localhost:8080

---

## ✅ Checklist Before Deploy

- [ ] All files committed
- [ ] `.gitignore` configured
- [ ] `README.md` updated
- [ ] Tested locally
- [ ] No sensitive API keys in code
- [ ] Images loading correctly
- [ ] Responsive design working
- [ ] Cross-browser tested

---

## 🎉 You're Ready!

Run these commands to deploy:

```bash
cd "c:\Users\KIRTAN JOSHI\project\project ALpha\img search"
git add .
git commit -m "Deploy image search app"
git push origin master
```

**Your live site**: https://kirtannjoshi.github.io/images-search/

---

Created: November 11, 2025
Status: Ready for deployment! 🚀
