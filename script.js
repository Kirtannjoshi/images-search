
document.addEventListener('DOMContentLoaded', () => {
            // --- UI Elements ---
            const searchInput = document.getElementById('search-input');
            const searchButton = document.getElementById('search-button');
            // Ensure Material 3 components are registered before accessing them
            customElements.whenDefined('md-filled-text-field').then(() => {
                console.log('md-filled-text-field is defined');
            });
            customElements.whenDefined('md-filled-button').then(() => {
                console.log('md-filled-button is defined');
            });
            customElements.whenDefined('md-icon-button').then(() => {
                console.log('md-icon-button is defined');
            });
            customElements.whenDefined('md-filled-tonal-button').then(() => {
                console.log('md-filled-tonal-button is defined');
            });
            const resultsDiv = document.getElementById('results');
            const loadingDiv = document.getElementById('loading');
            const skeletonGrid = document.getElementById('skeleton-loader');
            const categoryFiltersContainer = document.getElementById('categoryFilters');

            // --- Modal Elements ---
            const modal = document.getElementById('imageModal');
            const modalImg = document.getElementById('modalImage');
            const closeModalBtn = document.getElementById('closeModalBtn');
            const prevButton = document.querySelector('.modal-prev');
            const nextButton = document.querySelector('.modal-next');
            const modalImageTitle = document.getElementById('modalImageTitle');
            const modalImageResolution = document.getElementById('modalImageResolution');
            const modalDownloadBtn = document.getElementById('modalDownloadBtn');
            const modalShareBtn = document.getElementById('modalShareBtn');

            // --- Floating Search Button (Mobile) ---
            const floatingSearchButton = document.createElement('md-fab');
            floatingSearchButton.id = 'floatingSearchButton';
            floatingSearchButton.className = 'hidden'; // Class for visibility toggle
            floatingSearchButton.innerHTML = '<span class="material-symbols-outlined">search</span>';
            document.body.appendChild(floatingSearchButton);

            let currentImageIndex = 0;
            let allImages = [];
            let isLoading = false;
            let currentPage = 1;
            const favorites = new Set();

            // Performance optimization: Add caching
            const imageCache = new Map();
            const searchCache = new Map();
            let searchTimeout = null;

            // --- Environment detection (GitHub Pages vs Localhost) ---
            const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
            const API_BASE = isLocal ? 'http://localhost:3001' : '';
            const PROXY_BASE = isLocal ? 'http://localhost:8080/' : '';

            // Load favorites from memory (since localStorage is not available)
            let favoritesData = [];

            const categories = ['Nature', 'Wallpaper', '4K', 'Technology', 'Art', 'Travel', 'Animals', 'City Night', 'Abstract', 'Architecture', 'Food'];



            // --- Core Functions ---

            function extractHighQualityUrl(element) {
                const dataSrc = element.getAttribute('data-src');
                const originalSrc = element.getAttribute('data-original');
                const src = element.src || element.getAttribute('data-iurl');
                
                if (!src || src.startsWith('data:')) return null;

                // Skip SVG images as they are often icons or logos
                if (src.toLowerCase().endsWith('.svg')) return null;

                let highQualityUrl = dataSrc || originalSrc || src;
                
                // Multiple URL enhancement strategies
                highQualityUrl = highQualityUrl
                    .replace(/\/(\d+x|x\d+)\//, '/originals/')
                    .replace(/\bw=\d+\b/g, 'w=1920')
                    .replace(/\bh=\d+\b/g, 'h=1080')
                    .replace(/\bq=\d+\b/g, 'q=100')
                    .replace(/size=\w+/g, 'size=large')
                    .replace(/width=\d+/g, 'width=1920')
                    .replace(/height=\d+/g, 'height=1080')
                    .replace(/-\d+x\d+\./, '.')
                    .replace(/_thumb\./, '.');

                // Filter out logos, icons, and avatars
                if (highQualityUrl.includes('logo') || highQualityUrl.includes('icon') || highQualityUrl.includes('avatar')) {
                    return null;
                }

                return highQualityUrl;
            }

            function getImageDimensions(url) {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve({ width: img.width, height: img.height });
                    img.onerror = () => resolve({ width: 0, height: 0 });
                    img.src = url;
                });
            }

            async function validateImage(url) {
                try {
                    const response = await fetch(url, { method: 'HEAD' });
                    return response.ok;
                } catch (e) {
                    return false;
                }
            }

            // --- Skeleton Loader Helpers ---
            function showSkeletonLoading() {
                if (skeletonGrid) skeletonGrid.classList.remove('hidden');
            }

            function hideSkeletonLoading() {
                if (skeletonGrid) skeletonGrid.classList.add('hidden');
            }

            // Enhanced multi-source search with server API first (faster), then client-side fallback, with caching
            async function searchImages(query, page = 1) {
                if (!query) {
                    showWelcomeMessage();
                    return;
                }

                // Check cache first for performance
                const cacheKey = `${query}-${page}`;
                if (searchCache.has(cacheKey)) {
                    const cachedResults = searchCache.get(cacheKey);
                    if (page === 1) {
                        resultsDiv.innerHTML = '';
                        allImages = [];
                    }
                    displayImages(cachedResults);
                    return;
                }

                if (page === 1) {
                    currentPage = 1;
                    resultsDiv.innerHTML = '';
                    allImages = [];
                    showSkeletonLoading();
                }

                loadingDiv.classList.remove('hidden');
                isLoading = true;

                try {
                    // 1) Try server API first for speed and reliability
                    let allValidImages = [];
                    if (API_BASE) {
                        try {
                            const apiRes = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}&page=${page}`, {
                                headers: { 'Accept': 'application/json' }
                            });
                            if (apiRes.ok) {
                                const json = await apiRes.json();
                                allValidImages = json.results || [];
                            }
                        } catch (e) {
                            // ignore, fallback below
                        }
                    }

                    // 2) If API had nothing, fallback to client-side multi-source with timeouts
                    if (!allValidImages || allValidImages.length === 0) {
                        const searchPromises = [
                            Promise.race([
                                searchGoogleImages(query, page),
                                new Promise(resolve => setTimeout(() => resolve([]), 3000))
                            ]),
                            Promise.race([
                                searchUnsplash(query, page),
                                new Promise(resolve => setTimeout(() => resolve([]), 2000))
                            ]),
                            Promise.race([
                                searchPixabay(query, page),
                                new Promise(resolve => setTimeout(() => resolve([]), 2000))
                            ]),
                            Promise.race([
                                searchWikimediaCommons(query, page),
                                new Promise(resolve => setTimeout(() => resolve([]), 2500))
                            ])
                        ];

                        const results = await Promise.allSettled(searchPromises);
                        results.forEach(result => {
                            if (result.status === 'fulfilled' && result.value) {
                                allValidImages = [...allValidImages, ...result.value];
                            }
                        });
                    }

                    // Remove duplicates and sort by quality
                    const uniqueImages = removeDuplicateImages(allValidImages);
                    const sortedImages = sortImagesByQuality(uniqueImages);

                    // Cache results for faster subsequent searches
                    if (sortedImages.length > 0) {
                        searchCache.set(cacheKey, sortedImages.slice(0, 24));
                    }

                    if (sortedImages.length > 0) {
                        if (page === 1) {
                            resultsDiv.innerHTML = '';
                        }
                        displayImages(sortedImages.slice(0, 24)); // Show up to 24 best images
                        hideSkeletonLoading();
                    } else if (page === 1) {
                        hideSkeletonLoading();
                        showNoResults();
                    }
                } catch (error) {
                    console.error('Search error:', error);
                    if (page === 1) showError();
                } finally {
                    loadingDiv.classList.add('hidden');
                    isLoading = false;
                }
            }

            // Debounced search for real-time search as user types
            function debouncedSearch(query, page = 1) {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    searchImages(query, page);
                }, 300); // Wait 300ms after user stops typing
            }

            // Google Images scraper using CORS proxy
            async function searchGoogleImages(query, page = 1) {
                try {
                    if (!PROXY_BASE) return []; // Not available on GitHub Pages
                    const start = (page - 1) * 20;
                    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&start=${start}&ijn=0`;
                    const proxyUrl = `${PROXY_BASE}${searchUrl}`;
                    
                    const response = await fetch(proxyUrl, {
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest', // Required by CORS-anywhere
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                        }
                    });

                    if (!response.ok) throw new Error('Google search failed');

                    const html = await response.text();
                    return parseGoogleImages(html, query);
                } catch (error) {
                    console.log('Google Images search failed:', error);
                    return [];
                }
            }

            // Parse Google Images results
            function parseGoogleImages(html, query) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const images = [];

                // Look for image data in script tags
                const scriptTags = doc.querySelectorAll('script');
                for (let script of scriptTags) {
                    const content = script.textContent;
                    if (content.includes('["GRID_STATE0"') || content.includes('"ou":"')) {
                        const matches = content.match(/"ou":"([^"]+)"/g);
                        if (matches) {
                            matches.forEach(match => {
                                const url = match.replace('"ou":"', '').replace('"', '');
                                if (isValidImageUrl(url)) {
                                    images.push({
                                        highQualityUrl: url,
                                        alt: query,
                                        dimensions: { width: 800, height: 600 },
                                        source: 'google'
                                    });
                                }
                            });
                        }
                    }
                }

                return images.slice(0, 10); // Return top 10 from Google
            }

            // Unsplash API (free tier)
            async function searchUnsplash(query, page = 1) {
                try {
                    const accessKey = 'YOUR_UNSPLASH_ACCESS_KEY'; // You can get this free from unsplash.com/developers
                    const perPage = 10;
                    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&client_id=${accessKey}`;
                    
                    // If no API key, use a fallback approach
                    if (accessKey === 'YOUR_UNSPLASH_ACCESS_KEY') {
                        return searchUnsplashScrape(query, page);
                    }

                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Unsplash API failed');

                    const data = await response.json();
                    return data.results.map(photo => ({
                        highQualityUrl: photo.urls.regular,
                        alt: photo.alt_description || photo.description || query,
                        dimensions: { width: photo.width, height: photo.height },
                        source: 'unsplash'
                    }));
                } catch (error) {
                    console.log('Unsplash search failed:', error);
                    return [];
                }
            }

            // Unsplash scraping fallback
            async function searchUnsplashScrape(query, page = 1) {
                try {
                    if (!PROXY_BASE) return []; // Not available on GitHub Pages
                    const searchUrl = `https://unsplash.com/s/photos/${encodeURIComponent(query)}`;
                    const proxyUrl = `${PROXY_BASE}${searchUrl}`;
                    
                    const response = await fetch(proxyUrl, {
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest' // Required by CORS-anywhere
                        }
                    });
                    if (!response.ok) throw new Error('Unsplash scrape failed');

                    const html = await response.text();
                    return parseUnsplashImages(html, query);
                } catch (error) {
                    console.log('Unsplash scrape failed:', error);
                    return [];
                }
            }

            function parseUnsplashImages(html, query) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const images = [];

                // Look for image elements
                const imgElements = doc.querySelectorAll('img[src*="images.unsplash.com"]');
                imgElements.forEach(img => {
                    let src = img.src;
                    // Convert to high quality
                    src = src.replace(/w=\d+/, 'w=1600').replace(/&w=\d+/, '&w=1600');
                    
                    if (isValidImageUrl(src)) {
                        images.push({
                            highQualityUrl: src,
                            alt: img.alt || query,
                            dimensions: { width: 1600, height: 1200 },
                            source: 'unsplash'
                        });
                    }
                });

                return images.slice(0, 8); // Return top 8 from Unsplash
            }

            // Pixabay API (free)
            async function searchPixabay(query, page = 1) {
                try {
                    const apiKey = 'YOUR_PIXABAY_API_KEY'; // Free from pixabay.com/api/docs/
                    const perPage = 10;
                    
                    // If no API key, skip this source
                    if (apiKey === 'YOUR_PIXABAY_API_KEY') {
                        return [];
                    }

                    const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&min_width=800&min_height=600&per_page=${perPage}&page=${page}`;
                    
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Pixabay API failed');

                    const data = await response.json();
                    return data.hits.map(hit => ({
                        highQualityUrl: hit.largeImageURL,
                        alt: hit.tags || query,
                        dimensions: { width: hit.imageWidth, height: hit.imageHeight },
                        source: 'pixabay'
                    }));
                } catch (error) {
                    console.log('Pixabay search failed:', error);
                    return [];
                }
            }

            // Wikimedia Commons (no key, CORS-friendly) – good fallback for GitHub Pages
            async function searchWikimediaCommons(query, page = 1) {
                try {
                    const gsroffset = (page - 1) * 24;
                    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=24&prop=imageinfo&iiprop=url%7Csize&format=json&origin=*${gsroffset ? `&gsroffset=${gsroffset}` : ''}`;
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Wikimedia API failed');
                    const data = await response.json();
                    const pages = (data.query && data.query.pages) ? Object.values(data.query.pages) : [];
                    return pages
                        .map(p => {
                            const ii = p.imageinfo && p.imageinfo[0];
                            if (!ii || !ii.url) return null;
                            return {
                                highQualityUrl: ii.url,
                                alt: p.title.replace('File:', '').replace(/_/g, ' '),
                                dimensions: { width: ii.width || 1024, height: ii.height || 768 },
                                source: 'wikimedia'
                            };
                        })
                        .filter(Boolean);
                } catch (e) {
                    console.log('Wikimedia search failed:', e);
                    return [];
                }
            }

            function isValidImageUrl(url) {
                if (!url || url.startsWith('data:') || url.includes('logo') || url.includes('icon')) return false;
                const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];
                return imageExtensions.some(ext => url.toLowerCase().includes(ext)) || url.includes('images');
            }

            function removeDuplicateImages(images) {
                const seen = new Set();
                return images.filter(img => {
                    const key = img.highQualityUrl.split('?')[0]; // Remove query params for comparison
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            }

            function sortImagesByQuality(images) {
                return images.sort((a, b) => {
                    // Prioritize by source reliability and image dimensions
                    const sourceWeight = { google: 3, unsplash: 2, pixabay: 1, wikimedia: 1 };
                    const aW = (a.dimensions?.width || 0), aH = (a.dimensions?.height || 0);
                    const bW = (b.dimensions?.width || 0), bH = (b.dimensions?.height || 0);
                    const aScore = (sourceWeight[a.source] || 0) * 1000 + (aW * aH);
                    const bScore = (sourceWeight[b.source] || 0) * 1000 + (bW * bH);
                    return bScore - aScore;
                });
            }

        function displayImages(images) {
            const fragment = document.createDocumentFragment();

            images.forEach((imgData, index) => {
                const card = document.createElement('div');
                card.className = 'image-card';

                const aspectRatio = imgData.dimensions.height / imgData.dimensions.width;
                const isFavorited = favorites.has(imgData.highQualityUrl);

                card.innerHTML = `
                    <div class="aspect-ratio-box" style="padding-bottom: ${Math.min(aspectRatio * 100, 150)}%;">
                        <img src="${imgData.highQualityUrl}" alt="${imgData.alt}" loading="${index < 6 ? 'eager' : 'lazy'}" 
                             onerror="this.onerror=null; this.src='https://via.placeholder.com/800x600.png?text=Image+Not+Available'">
                    </div>
                    <div class="image-info">
                        <h3 class="image-title">${imgData.alt}</h3>
                        <p class="image-resolution">${imgData.dimensions.width} x ${imgData.dimensions.height}</p>
                        <div class="action-buttons">
                            <button class="download-btn">Download</button>
                            <button class="share-btn">Share</button>
                            <button class="favorite-btn ${isFavorited ? 'favorited' : ''}">
                                ${isFavorited ? '♥' : '♡'}
                            </button>
                        </div>
                    </div>
                `;

                const currentIndex = allImages.length;
                const img = card.querySelector('img');
                // Fade-in on load
                img.addEventListener('load', () => {
                    img.classList.add('loaded');
                }, { once: true });

                // Preload first few images for faster display
                if (index < 6) {
                    const preloadImg = new Image();
                    preloadImg.src = imgData.highQualityUrl;
                }

                // Add click event for modal
                img.addEventListener('click', () => showModal(imgData, currentIndex));

                // Add download event
                card.querySelector('.download-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    downloadImage(imgData.highQualityUrl, imgData.alt);
                });

                // Add share event
                card.querySelector('.share-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    shareImage(imgData.highQualityUrl, imgData.alt);
                });

                
                card.querySelector('.favorite-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleFavorite(imgData.highQualityUrl, e.target);
                });

                allImages.push(imgData);
                fragment.appendChild(card);
            });

            resultsDiv.appendChild(fragment);

            // Preload next batch of images in the background
            const preloadNext = () => {
                images.slice(6, 12).forEach(imgData => {
                    const preloadImg = new Image();
                    preloadImg.decoding = 'async';
                    preloadImg.loading = 'lazy';
                    preloadImg.src = imgData.highQualityUrl;
                });
            };
            if ('requestIdleCallback' in window) {
                requestIdleCallback(preloadNext, { timeout: 1500 });
            } else {
                setTimeout(preloadNext, 800);
            }
        }

        function showModal(imageObject, index) {
            currentImageIndex = index;
            modalImg.src = imageObject.highQualityUrl;
            modalImg.alt = imageObject.alt;
            modalImageTitle.textContent = imageObject.alt;
            modalImageResolution.textContent = `${imageObject.dimensions.width} x ${imageObject.dimensions.height}`;

            modalDownloadBtn.onclick = () => downloadImage(imageObject.highQualityUrl, imageObject.alt);
            modalShareBtn.onclick = () => shareImage(imageObject.highQualityUrl, imageObject.alt);
            // Show modal using class to match CSS transitions
            modal.classList.add('visible');
            document.body.style.overflow = 'hidden';
            updateModalNavigation();
        }

        function updateModalNavigation() {
            prevButton.style.visibility = currentImageIndex > 0 ? 'visible' : 'hidden';
            nextButton.style.visibility = currentImageIndex < allImages.length - 1 ? 'visible' : 'hidden';
        }

        function navigateModal(direction) {
            const newIndex = currentImageIndex + direction;
            if (newIndex >= 0 && newIndex < allImages.length) {
                showModal(allImages[newIndex], newIndex);
            }
        }

        function closeModal() {
            modal.classList.remove('visible');
            document.body.style.overflow = 'auto';
        }

        // Hook up modal controls
        closeModalBtn?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        prevButton?.addEventListener('click', (e) => { e.stopPropagation(); navigateModal(-1); });
        nextButton?.addEventListener('click', (e) => { e.stopPropagation(); navigateModal(1); });

        // Keyboard controls (Esc to close, arrows to navigate)
        window.addEventListener('keydown', (e) => {
            if (!modal.classList.contains('visible')) return;
            if (e.key === 'Escape') closeModal();
            if (e.key === 'ArrowLeft') navigateModal(-1);
            if (e.key === 'ArrowRight') navigateModal(1);
        });

        async function downloadImage(url, filename) {
            try {
                // Use our local CORS proxy for downloads
        const targetUrl = PROXY_BASE ? `${PROXY_BASE}${url}` : url;
        const response = await fetch(targetUrl, {
                    headers: {
            'X-Requested-With': PROXY_BASE ? 'XMLHttpRequest' : ''
                    }
                });
                
                if (!response.ok) throw new Error('Download failed');
                
                const blob = await response.blob();
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = (filename || 'image').replace(/[^a-z0-9]/gi, '_') + '.jpg';
                link.click();
                URL.revokeObjectURL(link.href);
            } catch (error) {
                console.error('Download failed:', error);
                // Fallback: open image in new tab
                window.open(url, '_blank');
            }
        }

        async function shareImage(url, title) {
            if (navigator.share) {
                try {
                    await navigator.share({ title: title, text: `Check out this image:`, url: url });
                } catch (error) {
                    console.error('Share failed:', error);
                }
            } else {
                try {
                    await navigator.clipboard.writeText(url);
                    alert('Image URL copied to clipboard!');
                } catch (error) {
                    console.error('Clipboard write failed:', error);
                    alert('Could not copy to clipboard');
                }
            }
        }

        function toggleFavorite(url, button) {
            if (favorites.has(url)) {
                favorites.delete(url);
                button.textContent = '♡';
                button.classList.remove('favorited');
            } else {
                favorites.add(url);
                button.textContent = '♥';
                button.classList.add('favorited');
            }
            // Update in-memory favorites data
            favoritesData = Array.from(favorites);
        }

        const debounce = (func, wait) => {
            let timeout;
            return (...args) => {
                const context = this;
                const later = () => {
                    timeout = null;
                    func.apply(context, args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };



        function showWelcomeMessage() {
            resultsDiv.innerHTML = `
                <div class="welcome-message">
                    <h2>Discover Amazing Images</h2>
                    <p>Search for high-quality images from multiple sources</p>
                    <p style="opacity: 0.7;">Use the search bar above or click on category filters</p>
                </div>
            `;
        }

        function showNoResults() {
            resultsDiv.innerHTML = `
                <div class="error-message">
                    <h3>No Images Found</h3>
                    <p>Try different search terms or check your spelling</p>
                    <p style="margin-top: 10px; opacity: 0.7;">We search multiple sources to find the best images for you</p>
                </div>
            `;
        }

        function showError() {
            resultsDiv.innerHTML = `
                <div class="error-message">
                    <h3>An Error Occurred</h3>
                    <p>The image sources may be temporarily unavailable</p>
                    <p style="margin-top: 10px; opacity: 0.7;">Please try again in a few moments</p>
                </div>
            `;
        }

        function setupCategoryFilters() {
            categories.forEach(category => {
                const button = document.createElement('md-filled-tonal-button');
                button.textContent = category;
                button.setAttribute('class', 'category-button'); // Add a class for potential future styling
                button.addEventListener('click', () => {
                    searchInput.value = category;
                    searchImages(category, 1);
                });
                categoryFiltersContainer.appendChild(button);
            });
        }

        // --- Event Listeners ---
        searchButton.addEventListener('click', () => searchImages(searchInput.value, 1));
        
        // Real-time search as user types (debounced)
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 2) { // Start searching after 3 characters
                debouncedSearch(query, 1);
            } else if (query.length === 0) {
                showWelcomeMessage();
            }
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout); // Clear debounce on enter
                searchImages(searchInput.value, 1);
            }
        });

        // Floating Search Button visibility on scroll
        let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
            if (window.innerWidth <= 768) { // Only apply on smaller screens
                if (window.scrollY > lastScrollY && window.scrollY > 100) {
                    floatingSearchButton.classList.add('hidden');
                } else if (window.scrollY < lastScrollY) {
                    floatingSearchButton.classList.remove('hidden');
                }
                lastScrollY = window.scrollY;
            }
    }, { passive: true });

        // Event listener for floating search button
        floatingSearchButton.addEventListener('click', () => {
            // Scroll to the top of the page smoothly
            window.scrollTo({ top: 0, behavior: 'smooth' });
            // Focus on the search input after scrolling
            searchInput.focus();
        });

        // Initial load
        showWelcomeMessage();
        setupCategoryFilters();

        // Load more images on scroll
    window.addEventListener('scroll', debounce(() => {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !isLoading) {
                currentPage++;
                searchImages(searchInput.value, currentPage);
            }
    }, 200), { passive: true });

        // Handle initial search if there's a query in the URL (e.g., from a share link)
        const urlParams = new URLSearchParams(window.location.search);
        const initialQuery = urlParams.get('q');
        if (initialQuery) {
            searchInput.value = initialQuery;
            searchImages(initialQuery, 1);
        }
        });