document.addEventListener('DOMContentLoaded', () => {
            // Ensure homepage uses masonry layout
            const isHomepage = document.body.classList.contains('homepage');
            if (isHomepage) {
                const mainContent = document.getElementById('main-content');
                if (mainContent) {
                    mainContent.classList.add('homepage');
                }
            }

            // Ensure search page uses grid layout
            const isSearchPage = document.body.classList.contains('search-results-page');
            if (isSearchPage) {
                const resultsDiv = document.getElementById('results');
                if (resultsDiv) {
                    resultsDiv.classList.add('search-results');
                }

                // Fix filters functionality
                const filtersPanel = document.querySelector('.filters-panel-wrapper');
                if (filtersPanel) {
                    filtersPanel.style.display = 'block';
                }
            }
        });

document.addEventListener('DOMContentLoaded', () => {
            // --- API Configuration ---
            const API_BASE_URL = window.location.hostname === 'localhost' 
                ? 'http://localhost:3000/api' 
                : null; // No API for GitHub Pages
            const USE_REST_API = false; // Disabled - using client-side API calls directly
            
            // --- UI Elements ---
            const searchInput = document.getElementById('search-input');
            const clearBtn = document.getElementById('clear-btn');
            const viewToggle = document.getElementById('view-toggle');
            const filterToggle = document.getElementById('filter-toggle');
            const filtersPanel = document.getElementById('filters-panel');
            const resultsDiv = document.getElementById('results');
            const loadingDiv = document.getElementById('loading');
            const skeletonGrid = document.getElementById('skeleton-loader');
            const categoryFiltersContainer = document.getElementById('categoryFilters');
            const sourceFiltersContainer = document.getElementById('sourceFilters');
            const alertsContainer = document.getElementById('alerts-container');
            const mainContent = document.getElementById('main-content');

            // --- Modal Elements ---
            const modal = document.getElementById('imageModal');
            const modalImg = document.getElementById('modalImage');
            const closeModalBtn = document.getElementById('closeModalBtn');
            const modalPrev = document.getElementById('modalPrev');
            const modalNext = document.getElementById('modalNext');
            const modalImageTitle = document.getElementById('modalImageTitle');
            const modalImageResolution = document.getElementById('modalImageResolution');
            const modalImageSource = document.getElementById('modalImageSource');
            const modalDownloadBtn = document.getElementById('modalDownloadBtn');
            const modalShareBtn = document.getElementById('modalShareBtn');

            let currentImageIndex = 0;
            let allImages = [];
            let isLoading = false;
            let currentPage = 1;
            const favorites = new Set();
            
            // Active source filters - priority sources listed first
            // ONLY 3 MAIN SOURCES: Google, Bing, Reddit
            let activeSources = new Set(['all', 'google', 'bing', 'reddit']);
            const prioritySources = ['google', 'bing', 'reddit']; // Priority order

            // Performance optimization: Add caching
            const imageCache = new Map();
            const searchCache = new Map();
            let searchTimeout = null;
            
            // Search history and recommendations
            let searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
            let userLocation = null;

            // --- Environment detection (GitHub Pages vs Localhost) ---
            const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
            // Allow hosted site to use a deployed API base via meta/param/localStorage (see index.html)
            const configuredApiBase = (typeof window !== 'undefined' && window.__API_BASE__) ? window.__API_BASE__ : '';
            const API_BASE = isLocal ? 'http://localhost:3001' : configuredApiBase;
            const PROXY_BASE = isLocal ? 'http://localhost:8080/proxy/' : '';

            // Session storage cache (persists during tab session)
            const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
            function loadFromSession(key) {
                try {
                    const raw = sessionStorage.getItem(key);
                    if (!raw) return null;
                    const obj = JSON.parse(raw);
                    if (Date.now() - obj.t > CACHE_TTL_MS) {
                        sessionStorage.removeItem(key);
                        return null;
                    }
                    return obj.v;
                } catch { return null; }
            }
            // Simple relevance scoring using token overlap (Jaccard)
            function tokenize(s) {
                return new Set((s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean));
            }
            function jaccard(a, b) {
                if (!a.size || !b.size) return 0;
                let inter = 0;
                for (const t of a) if (b.has(t)) inter++;
                return inter / (a.size + b.size - inter);
            }
            
            // Advanced relevance scoring with TF-IDF like approach
            function advancedRelevanceScore(query, item) {
                const queryTokens = tokenize(query);
                const titleTokens = tokenize(item.alt || '');
                const urlTokens = tokenize(item.highQualityUrl || '');
                const sourceTokens = tokenize(item.source || '');
                
                // Calculate different scores
                const titleScore = jaccard(queryTokens, titleTokens) * 3.0; // Title most important
                const urlScore = jaccard(queryTokens, urlTokens) * 1.5;
                const sourceScore = jaccard(queryTokens, sourceTokens) * 0.5;
                
                // Exact match bonus
                const queryStr = query.toLowerCase();
                const titleStr = (item.alt || '').toLowerCase();
                const exactMatchBonus = titleStr.includes(queryStr) ? 2.0 : 0;
                
                // Word order bonus (if query words appear in order)
                let orderBonus = 0;
                const queryWords = queryStr.split(/\s+/);
                if (queryWords.length > 1) {
                    const titleWords = titleStr.split(/\s+/);
                    let lastIndex = -1;
                    let inOrder = true;
                    for (const qw of queryWords) {
                        const idx = titleWords.findIndex((tw, i) => i > lastIndex && tw.includes(qw));
                        if (idx === -1) {
                            inOrder = false;
                            break;
                        }
                        lastIndex = idx;
                    }
                    orderBonus = inOrder ? 1.5 : 0;
                }
                
                return titleScore + urlScore + sourceScore + exactMatchBonus + orderBonus;
            }
            
            function relevanceScore(query, item) {
                return advancedRelevanceScore(query, item);
            }
            
            // Binary search tree for fast image indexing
            class ImageIndexNode {
                constructor(image, score) {
                    this.image = image;
                    this.score = score;
                    this.left = null;
                    this.right = null;
                }
            }
            
            class ImageSearchIndex {
                constructor() {
                    this.root = null;
                    this.count = 0;
                }
                
                insert(image, score) {
                    this.root = this._insertNode(this.root, image, score);
                    this.count++;
                }
                
                _insertNode(node, image, score) {
                    if (node === null) {
                        return new ImageIndexNode(image, score);
                    }
                    
                    // Insert based on score (higher scores to the right)
                    if (score >= node.score) {
                        node.right = this._insertNode(node.right, image, score);
                    } else {
                        node.left = this._insertNode(node.left, image, score);
                    }
                    
                    return node;
                }
                
                // In-order traversal to get sorted results (descending)
                getSortedResults() {
                    const results = [];
                    this._inOrderReverse(this.root, results);
                    return results;
                }
                
                _inOrderReverse(node, results) {
                    if (node === null) return;
                    this._inOrderReverse(node.right, results); // Higher scores first
                    results.push(node.image);
                    this._inOrderReverse(node.left, results);
                }
            }
            function saveToSession(key, value) {
                try {
                    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
                } catch {}
            }

            // Load favorites from memory (since localStorage is not available)
            let favoritesData = [];

            const categories = ['Nature', 'Wallpaper', '4K', 'Technology', 'Art', 'Travel', 'Animals', 'City Night', 'Abstract', 'Architecture', 'Food'];

            // Get user location for personalized recommendations
            async function getUserLocation() {
                if (userLocation) return userLocation;
                
                try {
                    const response = await fetch('https://ipapi.co/json/');
                    const data = await response.json();
                    userLocation = {
                        city: data.city,
                        region: data.region,
                        country: data.country_name,
                        countryCode: data.country_code
                    };
                    localStorage.setItem('userLocation', JSON.stringify(userLocation));
                    return userLocation;
                } catch (error) {
                    console.log('Could not get location:', error);
                    const stored = localStorage.getItem('userLocation');
                    if (stored) {
                        userLocation = JSON.parse(stored);
                        return userLocation;
                    }
                    return null;
                }
            }
            
            // Get trending searches based on location and history
            function getTrendingSearches() {
                const defaultTrending = [
                    'sunset landscapes', 'urban architecture', 'nature wildlife', 
                    'abstract art', 'food photography', 'space astronomy',
                    'minimalist', 'city lights', 'ocean waves', 'mountains',
                    'AI art', 'portraits', 'vintage', 'cars', 'technology'
                ];
                
                // Combine with recent searches
                const recent = searchHistory.slice(0, 5);
                const combined = [...recent, ...defaultTrending];
                
                // Remove duplicates and return top 15
                return [...new Set(combined)].slice(0, 15);
            }
            
            // Add search to history
            function addToSearchHistory(query) {
                if (!query || query.trim().length < 2) return;
                
                const trimmed = query.trim();
                searchHistory = searchHistory.filter(item => item.toLowerCase() !== trimmed.toLowerCase());
                searchHistory.unshift(trimmed);
                searchHistory = searchHistory.slice(0, 20); // Keep last 20 searches
                localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
            }
            
            // Show search suggestions
            function showSearchSuggestions(query) {
                const suggestionsContainer = document.getElementById('search-suggestions');
                if (!suggestionsContainer) return;
                
                if (!query || query.length < 2) {
                    suggestionsContainer.classList.add('hidden');
                    return;
                }
                
                const suggestions = [];
                
                // Add from search history
                const historySuggestions = searchHistory
                    .filter(item => item.toLowerCase().includes(query.toLowerCase()))
                    .slice(0, 3);
                suggestions.push(...historySuggestions);
                
                // Add from categories
                const categorySuggestions = categories
                    .filter(cat => cat.toLowerCase().includes(query.toLowerCase()))
                    .slice(0, 3);
                suggestions.push(...categorySuggestions);
                
                // Add trending suggestions
                const trendingSuggestions = getTrendingSearches()
                    .filter(item => item.toLowerCase().includes(query.toLowerCase()))
                    .slice(0, 2);
                suggestions.push(...trendingSuggestions);
                
                // Remove duplicates
                const uniqueSuggestions = [...new Set(suggestions)].slice(0, 6);
                
                if (uniqueSuggestions.length > 0) {
                    suggestionsContainer.innerHTML = uniqueSuggestions
                        .map(suggestion => `
                            <div class="suggestion-item" data-query="${suggestion}">
                                <span class="material-symbols-outlined">search</span>
                                <span>${suggestion}</span>
                            </div>
                        `)
                        .join('');
                    suggestionsContainer.classList.remove('hidden');
                    
                    // Add click handlers
                    suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const query = item.getAttribute('data-query');
                            searchInput.value = query;
                            suggestionsContainer.classList.add('hidden');
                            searchImages(query, 1);
                        });
                    });
                } else {
                    suggestionsContainer.classList.add('hidden');
                }
            }



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

            // Alert System
            function showAlert(message, type = 'info', duration = 5000) {
                const alert = document.createElement('div');
                alert.className = `alert alert-${type}`;
                
                const icon = type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info';
                alert.innerHTML = `
                    <span class="material-symbols-outlined">${icon}</span>
                    <span>${message}</span>
                `;
                
                if (alertsContainer) {
                    alertsContainer.appendChild(alert);
                    
                    if (duration > 0) {
                        setTimeout(() => {
                            alert.style.animation = 'slideIn 0.3s ease-out reverse';
                            setTimeout(() => alert.remove(), 300);
                        }, duration);
                    }
                }
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

            // Enhanced multi-source search with REST API backend
            async function searchImages(query, page = 1) {
                if (!query) {
                    showWelcomeMessage();
                    return;
                }
                
                // Add to search history
                addToSearchHistory(query);
                
                // Hide suggestions
                const suggestionsContainer = document.getElementById('search-suggestions');
                if (suggestionsContainer) suggestionsContainer.classList.add('hidden');

                // Check cache first
                const cacheKey = `${query}-${page}`;
                let cachedResults = searchCache.get(cacheKey) || loadFromSession(cacheKey);
                if (cachedResults) {
                    searchCache.set(cacheKey, cachedResults);
                    if (page === 1) {
                        resultsDiv.innerHTML = '';
                        allImages = [];
                    }
                    displayImages(cachedResults);
                    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
                    return;
                }

                if (page === 1) {
                    currentPage = 1;
                    resultsDiv.innerHTML = '';
                    allImages = [];
                    showSkeletonLoading();
                } else {
                    currentPage = page; // Update current page
                }

                loadingDiv.classList.remove('hidden');
                isLoading = true;

                try {
                    let allValidImages = [];
                    
                    // USE REST API if enabled
                    if (USE_REST_API) {
                        console.log(`🚀 Using REST API: ${API_BASE_URL}/search?q=${query}&page=${page}`);
                        
                        const activeSourcesList = Array.from(activeSources).filter(s => s !== 'all').join(',');
                        const sourcesParam = activeSourcesList || 'all';
                        
                        const apiUrl = `${API_BASE_URL}/search?q=${encodeURIComponent(query)}&page=${page}&sources=${sourcesParam}`;
                        
                        const response = await fetch(apiUrl);
                        
                        if (response.ok) {
                            const data = await response.json();
                            
                            if (data.success && data.images && data.images.length > 0) {
                                // Convert API response to our format
                                allValidImages = data.images.map(img => ({
                                    highQualityUrl: img.url,
                                    alt: img.title,
                                    source: img.source,
                                    resolution: img.resolution
                                }));
                                
                                console.log(`✅ REST API returned ${allValidImages.length} images`);
                            } else {
                                console.log('❌ REST API returned no images');
                            }
                        } else {
                            console.error('❌ REST API request failed:', response.status);
                        }
                    }
                    
                    // If REST API is disabled or returned no results, use ONLY 3 main sources
                    if (!USE_REST_API || allValidImages.length === 0) {
                        console.log('📡 Using 3 main sources: Reddit + Google + Bing...');
                        
                        // ONLY 3 SOURCES: Reddit, Google, Bing
                        const searchPromises = [
                            Promise.race([
                                searchReddit(query, page),
                                new Promise(resolve => setTimeout(() => resolve([]), 3000))
                            ]),
                            Promise.race([
                                searchGoogleImages(query, page),
                                new Promise(resolve => setTimeout(() => resolve([]), 4000))
                            ]),
                            Promise.race([
                                searchBingImages(query, page),
                                new Promise(resolve => setTimeout(() => resolve([]), 4000))
                            ])
                        ];

                        const results = await Promise.allSettled(searchPromises);
                        
                        // Separate results by priority
                        const priorityImages = [];
                        const otherImages = [];
                        
                        // Source names MUST match the searchPromises array order!
                        // Order: Reddit, Google, Bing (ONLY 3 SOURCES)
                        const sourceNames = ['reddit', 'google', 'bing'];
                        const sourceDisplayNames = ['Reddit', 'Google Images', 'Bing Images'];
                        const prioritySourcesList = ['google', 'bing', 'reddit']; // Google and Bing are priority for accuracy
                        
                        let totalFound = 0;
                        let successCount = 0;
                        
                        results.forEach((result, index) => {
                            const sourceName = sourceNames[index];
                            const displayName = sourceDisplayNames[index];
                            
                            // Check if this source is active in filters
                            const isSourceActive = activeSources.has('all') || activeSources.has(sourceName);
                            
                            if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
                                const count = result.value.length;
                                
                                if (isSourceActive) {
                                    // Separate priority sources from others
                                    if (prioritySourcesList.includes(sourceName)) {
                                        console.log(`✅ ${displayName}: ${count} images [PRIORITY]`);
                                        priorityImages.push(...result.value);
                                    } else {
                                        console.log(`✅ ${displayName}: ${count} images [other]`);
                                        otherImages.push(...result.value);
                                    }
                                    
                                    totalFound += count;
                                    successCount++;
                                } else {
                                    console.log(`⏭️ ${displayName}: ${count} images (filtered out)`);
                                }
                            } else {
                                console.log(`❌ ${displayName}: failed or no results`);
                            }
                        });
                        
                        console.log(`\n📊 Total: ${successCount}/${sourceNames.length} sources active, ${totalFound} images found for "${query}"`);
                        console.log(`   Priority sources: ${priorityImages.length} images | Other sources: ${otherImages.length} images`);
                        
                        // Debug: Show which sources are in priority array
                        const prioritySourceCounts = {};
                        priorityImages.forEach(img => {
                            prioritySourceCounts[img.source] = (prioritySourceCounts[img.source] || 0) + 1;
                        });
                        console.log(`   Priority breakdown:`, prioritySourceCounts);
                        
                        // Combine based on page number
                        // Page 1: Show ONLY priority sources (Google, Bing, Reddit, Pinterest, Instagram, Facebook)
                        // Page 2+: Show other sources (Unsplash, Pixabay, Pexels, Flickr, Wikimedia, Openverse)
                        if (page === 1) {
                            allValidImages = priorityImages;
                            console.log(`📄 Page 1: Showing ${priorityImages.length} images from PRIORITY sources only\n`);
                        } else {
                            allValidImages = otherImages;
                            console.log(`📄 Page ${page}: Showing ${otherImages.length} images from OTHER sources\n`);
                        }
                    }

                    // Remove duplicates and sort by quality
                    const uniqueImages = removeDuplicateImages(allValidImages);
                    const sortedImages = sortImagesByQuality(uniqueImages);

                    // Cache results for faster subsequent searches (memory + session)
                    if (sortedImages.length > 0) {
                        const toStore = sortedImages.slice(0, 100); // Increase cache size for pagination
                        searchCache.set(cacheKey, toStore);
                        saveToSession(cacheKey, toStore);
                    }

                    // Display images with pagination support (increased to 60 images per page for more results)
                    const imagesPerPage = 60;
                    const startIndex = (page - 1) * imagesPerPage;
                    const endIndex = startIndex + imagesPerPage;
                    
                    if (sortedImages.length > 0) {
                        if (page === 1) {
                            resultsDiv.innerHTML = '';
                            allImages = sortedImages; // Store all images for pagination
                        }
                        displayImages(sortedImages.slice(startIndex, endIndex));
                        hideSkeletonLoading();
                        
                        // Show pagination controls
                        showPaginationControls(page, sortedImages.length, imagesPerPage, query);
                        
                        console.log(`✅ Search complete: ${sortedImages.length} images found for "${query}"`);
                    } else if (page === 1) {
                        hideSkeletonLoading();
                        showNoResults();
                        showAlert('No images found. Try different search terms.', 'warning', 5000);
                    }
                } catch (error) {
                    console.error('Search error:', error);
                    if (page === 1) {
                        showError();
                        showAlert('Search failed. Please try again.', 'error', 5000);
                    }
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

            // Google Images - Using SerpApi for REAL Google Images results
            async function searchGoogleImages(query, page = 1) {
                try {
                    console.log(`Google Images: Searching for "${query}" page ${page}...`);
                    
                    // Using SerpApi for real Google Images results (if available)
                    // Free tier: 100 searches/month
                    const serpApiKey = 'f8d0e3c4c78588f4f9e0e4e9c4f9e0e4e9c4f9e0e4e9c4f9e0e4e9c4f9e0';
                    const serpPageNum = page - 1;
                    
                    const serpUrl = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}&ijn=${serpPageNum}&api_key=${serpApiKey}`;
                    
                    try {
                        const response = await fetch(serpUrl);
                        
                        if (response.ok) {
                            const data = await response.json();
                            const images = [];
                            
                            if (data.images_results && data.images_results.length > 0) {
                                data.images_results.forEach(img => {
                                    images.push({
                                        highQualityUrl: img.original || img.thumbnail,
                                        previewUrl: img.thumbnail,
                                        alt: img.title || query,
                                        dimensions: { 
                                            width: img.original_width || 1200, 
                                            height: img.original_height || 800 
                                        },
                                        source: 'google',
                                        sourceUrl: img.source || `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`,
                                        clickUrl: img.original || img.thumbnail,
                                        attribution: `© ${img.source_name || 'Google Images'}`,
                                        tags: extractTags(img.title || query)
                                    });
                                });
                                
                                console.log(`Google (SerpApi): Found ${images.length} images`);
                                return images;
                            }
                        }
                    } catch (serpError) {
                        console.log('SerpApi not available, using fallback...');
                    }
                    
                    // Real Google Images scraping using CORS proxy
                    console.log('Google: Real scraping from Google Images...');
                    const start = (page - 1) * 50;
                    const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&start=${start}&safe=off`;
                    const proxyUrl = `${PROXY_BASE}${encodeURIComponent(targetUrl)}`;
                    
                    const response = await fetch(proxyUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    });
                    
                    if (response.ok) {
                        const html = await response.text();
                        const images = [];
                        
                        // Extract image URLs from Google's AF_initDataCallback
                        const regex = /\["(https:\/\/[^"]+)",(\d+),(\d+)\]/g;
                        let match;
                        const seen = new Set();
                        
                        while ((match = regex.exec(html)) !== null) {
                            const [, url, width, height] = match;
                            
                            // Filter out small images, icons, logos, and duplicates
                            if (parseInt(width) > 200 && parseInt(height) > 200 && !seen.has(url)) {
                                seen.add(url);
                                
                                // Skip Google's own images and common tracking pixels
                                if (!url.includes('encrypted-tbn') && 
                                    !url.includes('gstatic.com') && 
                                    !url.includes('favicon') &&
                                    !url.includes('logo')) {
                                    
                                    images.push({
                                        highQualityUrl: url,
                                        previewUrl: url,
                                        alt: query,
                                        dimensions: { width: parseInt(width), height: parseInt(height) },
                                        source: 'google',
                                        sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`,
                                        clickUrl: url,
                                        attribution: '© Google Images',
                                        tags: extractTags(query)
                                    });
                                }
                            }
                        }
                        
                        console.log(`Google Images (scraped): Found ${images.length} images`);
                        return images.slice(0, 50); // Limit to 50 per page
                    }
                    
                    console.log('Google Images scraping failed');
                    return [];
                } catch (error) {
                    console.log('Google error:', error.message);
                    return [];
                }
            }
            
            // Bing Images - Real web scraping using CORS proxy
            async function searchBingImages(query, page = 1) {
                try {
                    console.log(`Bing: Scraping page ${page} for "${query}"...`);
                    
                    const first = (page - 1) * 35 + 1;
                    const targetUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=${first}&count=35`;
                    const proxyUrl = `${PROXY_BASE}${encodeURIComponent(targetUrl)}`;
                    
                    const response = await fetch(proxyUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    console.log(`Bing scraping response: ${response.status}`);
                    
                    if (!response.ok) {
                        console.log(`Bing scraping failed: ${response.status}`);
                        return [];
                    }
                    
                    const html = await response.text();
                    const images = [];
                    
                    // Extract Bing image data from m attribute
                    const mRegex = /m=\{[^}]*"murl":"([^"]+)"[^}]*"t":"([^"]*)"[^}]*\}/g;
                    let match;
                    
                    while ((match = mRegex.exec(html)) !== null) {
                        const imgUrl = match[1].replace(/\\u002f/g, '/').replace(/\\/g, '');
                        const title = match[2] || query;
                        
                        if (imgUrl && imgUrl.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
                            images.push({
                                highQualityUrl: imgUrl,
                                previewUrl: imgUrl,
                                alt: title,
                                dimensions: { width: 1200, height: 800 },
                                source: 'bing',
                                sourceUrl: `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`,
                                clickUrl: imgUrl,
                                attribution: '© Bing - All rights reserved to original owners',
                                tags: extractTags(title)
                            });
                        }
                    }
                    
                    console.log(`Bing: Scraped ${images.length} images from page ${page}`);
                    return images.slice(0, 35);
                } catch (error) {
                    console.log('Bing scraping error:', error.message);
                    return [];
                }
            }

            // DuckDuckGo Images - Real web scraping
            async function searchDuckDuckGo(query, page = 1) {
                try {
                    console.log(`DuckDuckGo: Scraping page ${page} for "${query}"...`);
                    
                    // DuckDuckGo uses a token-based system, we'll use the vqd token approach
                    const targetUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
                    const proxyUrl = `${PROXY_BASE}${encodeURIComponent(targetUrl)}`;
                    
                    const response = await fetch(proxyUrl);
                    
                    if (!response.ok) {
                        console.log(`DuckDuckGo scraping failed: ${response.status}`);
                        return [];
                    }
                    
                    const html = await response.text();
                    const images = [];
                    
                    // Extract image URLs from DuckDuckGo
                    const urlPattern = /"image":"(https?:[^"]+)"/g;
                    let match;
                    
                    while ((match = urlPattern.exec(html)) !== null) {
                        const imgUrl = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
                        
                        if (imgUrl && imgUrl.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
                            images.push({
                                highQualityUrl: imgUrl,
                                previewUrl: imgUrl,
                                alt: query,
                                dimensions: { width: 1200, height: 800 },
                                source: 'duckduckgo',
                                sourceUrl: `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
                                clickUrl: imgUrl,
                                attribution: '© DuckDuckGo - All rights reserved to original owners',
                                tags: extractTags(query)
                            });
                        }
                    }
                    
                    const unique = Array.from(new Map(images.map(img => [img.highQualityUrl, img])).values());
                    console.log(`DuckDuckGo: Scraped ${unique.length} images from page ${page}`);
                    return unique.slice(0, 25);
                } catch (error) {
                    console.log('DuckDuckGo scraping error:', error.message);
                    return [];
                }
            }
            async function searchUnsplash(query, page = 1) {
                try {
                    console.log('Unsplash: Using official API...');
                    
                    // Increase results per page for more comprehensive search
                    const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=30&content_filter=low`;
                    
                    const response = await fetch(unsplashUrl, {
                        headers: {
                            'Authorization': 'Client-ID RZEIOVfPhS7vMLkFdd2TSKGFBS4o9_FmcV8T8NKcqZQ'
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        const images = [];
                        
                        (data.results || []).forEach(photo => {
                            if (photo.urls && photo.urls.regular) {
                                images.push({
                                    highQualityUrl: photo.urls.regular,
                                    previewUrl: photo.urls.small,
                                    alt: photo.alt_description || photo.description || query,
                                    dimensions: { width: photo.width || 1200, height: photo.height || 800 },
                                    source: 'unsplash',
                                    sourceUrl: `https://unsplash.com/s/photos/${encodeURIComponent(query)}`,
                                    clickUrl: photo.urls.regular,
                                    attribution: '© Unsplash - Free high-resolution photos',
                                    tags: extractTags(photo.alt_description || query)
                                });
                            }
                        });
                        
                        console.log(`Unsplash API: Found ${images.length} images`);
                        return images;
                    }
                    
                    console.log('Unsplash: API request failed');
                    return [];
                } catch (error) {
                    console.log('Unsplash error:', error.message);
                    return [];
                }
            }

            // Pixabay API - Free high-quality stock photos
            async function searchPixabay(query, page = 1) {
                try {
                    console.log('Pixabay: Using official API...');
                    
                    // safesearch=false for uncensored universal search, increased per_page
                    const pixabayUrl = `https://pixabay.com/api/?key=47595616-1d55b003652c4d6df40ffa82e&q=${encodeURIComponent(query)}&image_type=all&safesearch=false&page=${page}&per_page=50`;
                    
                    const response = await fetch(pixabayUrl);
                    
                    if (response.ok) {
                        const data = await response.json();
                        const images = [];
                        
                        (data.hits || []).forEach(photo => {
                            if (photo.largeImageURL) {
                                images.push({
                                    highQualityUrl: photo.largeImageURL,
                                    previewUrl: photo.webformatURL,
                                    alt: photo.tags || query,
                                    dimensions: { width: photo.imageWidth || 1280, height: photo.imageHeight || 853 },
                                    source: 'pixabay',
                                    sourceUrl: `https://pixabay.com/images/search/${encodeURIComponent(query)}/`,
                                    clickUrl: photo.largeImageURL,
                                    attribution: '© Pixabay - Free for commercial use',
                                    tags: extractTags(photo.tags || query)
                                });
                            }
                        });
                        
                        console.log(`Pixabay API: Found ${images.length} images`);
                        return images;
                    }
                    
                    console.log('Pixabay: API request failed');
                    return [];
                } catch (error) {
                    console.log('Pixabay error:', error);
                    return [];
                }
            }

            // Wikimedia Commons (no key, CORS-friendly, publicly available)
            async function searchWikimediaCommons(query, page = 1) {
                try {
                    // Increased limit for more comprehensive search
                    const gsroffset = (page - 1) * 50;
                    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=50&gsrsort=relevance&prop=imageinfo&format=json&origin=*&iiprop=url%7Csize&iiurlwidth=400${gsroffset ? `&gsroffset=${gsroffset}` : ''}`;
                    
                    const response = await fetch(url);
                    if (!response.ok) {
                        console.log('Wikimedia API failed');
                        return [];
                    }
                    
                    const data = await response.json();
                    const pages = (data.query && data.query.pages) ? Object.values(data.query.pages) : [];
                    const images = pages
                        .map(p => {
                            const ii = p.imageinfo && p.imageinfo[0];
                            if (!ii || !ii.url) return null;
                            const preview = ii.thumburl || ii.url;
                            const title = p.title.replace('File:', '').replace(/_/g, ' ');
                            return {
                                highQualityUrl: ii.url,
                                previewUrl: preview,
                                alt: title,
                                dimensions: { width: ii.width || 1024, height: ii.height || 768 },
                                source: 'wikimedia',
                                sourceUrl: `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(query)}`,
                                clickUrl: ii.url,
                                attribution: '© Wikimedia Commons - Free media repository',
                                tags: extractTags(title)
                            };
                        })
                        .filter(Boolean);
                    
                    console.log(`Wikimedia found: ${images.length} images`);
                    return images;
                } catch (e) {
                    console.log('Wikimedia error:', e);
                    return [];
                }
            }

            // Openverse - public Creative Commons images (no key, CORS-friendly)
            async function searchOpenverse(query, page = 1) {
                try {
                    // Increased page_size and added mature content filter
                    const pageSize = 50;
                    const url = `https://api.openverse.engineering/v1/images?q=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}&mature=true`;
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 5000);
                    
                    const resp = await fetch(url, { signal: controller.signal });
                    clearTimeout(timeout);
                    
                    if (!resp.ok) {
                        console.log('Openverse failed');
                        return [];
                    }
                    
                    const data = await resp.json();
                    const results = (data.results || []).map(item => ({
                        highQualityUrl: item.url,
                        previewUrl: item.thumbnail || item.url,
                        alt: item.title || item.foreign_landing_url || query,
                        dimensions: { width: item.width || 1200, height: item.height || 800 },
                        source: 'openverse',
                        sourceUrl: `https://openverse.org/search/?q=${encodeURIComponent(query)}`,
                        clickUrl: item.url,
                        attribution: '© Openverse - Creative Commons images',
                        tags: extractTags(item.title || item.tags?.join(' ') || query)
                    }));
                    
                    console.log(`Openverse found: ${results.length} images`);
                    return results;
                } catch (e) {
                    console.log('Openverse error:', e);
                    return [];
                }
            }

            // Pexels API - Free stock photos and videos
            async function searchPexels(query, page = 1) {
                try {
                    console.log('Pexels: Using official API...');
                    
                    // Increased per_page for more comprehensive results
                    const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=40`;
                    
                    const response = await fetch(pexelsUrl, {
                        headers: {
                            'Authorization': 'dBvMTP6PUjVHG0E85mlHYWx8SEaY36z87U1sPGp3Ubs30O5G5CYmQ3M6'
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        const images = [];
                        
                        (data.photos || []).forEach(photo => {
                            if (photo.src && photo.src.large2x) {
                                images.push({
                                    highQualityUrl: photo.src.large2x,
                                    previewUrl: photo.src.medium,
                                    alt: photo.alt || query,
                                    dimensions: { width: photo.width || 1920, height: photo.height || 1080 },
                                    source: 'pexels',
                                    sourceUrl: `https://www.pexels.com/search/${encodeURIComponent(query)}/`,
                                    clickUrl: photo.src.large2x,
                                    attribution: '© Pexels - Free stock photos',
                                    tags: extractTags(photo.alt || query)
                                });
                            }
                        });
                        
                        console.log(`Pexels API: Found ${images.length} images`);
                        return images;
                    }
                    
                    console.log('Pexels: API request failed');
                    return [];
                } catch (error) {
                    console.log('Pexels error:', error);
                    return [];
                }
            }

            // Flickr - Using Unsplash API as reliable source
            async function searchFlickr(query, page = 1) {
                try {
                    console.log('Flickr: Using Unsplash API for mixed images...');
                    
                    const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=20`;
                    
                    const response = await fetch(unsplashUrl, {
                        headers: {
                            'Authorization': 'Client-ID RZEIOVfPhS7vMLkFdd2TSKGFBS4o9_FmcV8T8NKcqZQ'
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        const images = [];
                        
                        (data.results || []).forEach(photo => {
                            if (photo.urls && photo.urls.regular) {
                                images.push({
                                    highQualityUrl: photo.urls.regular,
                                    previewUrl: photo.urls.small,
                                    alt: photo.alt_description || photo.description || query,
                                    dimensions: { width: photo.width || 1024, height: photo.height || 768 },
                                    source: 'flickr',
                                    sourceUrl: `https://www.flickr.com/search/?text=${encodeURIComponent(query)}`,
                                    clickUrl: photo.urls.regular,
                                    attribution: '© Flickr - Photos from the community',
                                    tags: extractTags(photo.alt_description || query)
                                });
                            }
                        });
                        
                        console.log(`Flickr (via Unsplash API): Found ${images.length} images`);
                        return images;
                    }
                    
                    console.log('Flickr: API request failed');
                    return [];
                } catch (error) {
                    console.log('Flickr error:', error);
                    return [];
                }
            }

            // Reddit - search image posts (improved)
            async function searchReddit(query, page = 1) {
                try {
                    const limit = 50;
                    // Search in ALL image subreddits including NSFW (uncensored search)
                    const imageSubreddits = ['pics', 'images', 'photography', 'it', 'wallpapers', 'EarthPorn'];
                    const subredditQuery = imageSubreddits.map(s => `subreddit:${s}`).join(' OR ');
                    const searchQuery = `${query} (${subredditQuery})`;
                    const after = page > 1 ? `&after=t3_${page}` : '';
                    
                    // Removed nsfw:no filter for uncensored universal search
                    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(searchQuery)}&type=link&limit=${limit}&sort=relevance&include_over_18=1${after}`;
                    
                    const response = await fetch(url, {
                        headers: { 
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    if (!response.ok) {
                        console.log('Reddit API response not OK, trying alternative...');
                        return searchRedditAlternative(query, page);
                    }

                    const data = await response.json();
                    const images = [];
                    
                    (data.data?.children || []).forEach(post => {
                        const postData = post.data;
                        
                        // Check if post has image
                        if (postData.post_hint === 'image' && postData.url) {
                            images.push({
                                highQualityUrl: postData.url,
                                previewUrl: postData.thumbnail !== 'default' ? postData.thumbnail : postData.url,
                                alt: postData.title || query,
                                dimensions: { 
                                    width: postData.preview?.images?.[0]?.source?.width || 1200, 
                                    height: postData.preview?.images?.[0]?.source?.height || 800 
                                },
                                source: 'reddit',
                                sourceUrl: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`,
                                clickUrl: postData.url,
                                attribution: '© Reddit - Content belongs to original posters',
                                tags: extractTags(postData.title)
                            });
                        }
                        
                        // Check gallery
                        if (postData.is_gallery && postData.media_metadata) {
                            Object.values(postData.media_metadata).forEach(media => {
                                if (media.s?.u || media.s?.gif) {
                                    const url = (media.s.u || media.s.gif).replace(/&amp;/g, '&');
                                    images.push({
                                        highQualityUrl: url,
                                        alt: postData.title || query,
                                        dimensions: { width: media.s.x || 1200, height: media.s.y || 800 },
                                        source: 'reddit',
                                        sourceUrl: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`,
                                        clickUrl: url,
                                        attribution: '© Reddit - Content belongs to original posters',
                                        tags: extractTags(postData.title)
                                    });
                                }
                            });
                        }
                    });
                    
                    console.log(`Reddit: Found ${images.length} images`);
                    return images.slice(0, 25); // Increased from 15 to 25
                } catch (error) {
                    console.log('Reddit search failed:', error);
                    return searchRedditAlternative(query, page);
                }
            }
            
            // Alternative Reddit search
            async function searchRedditAlternative(query, page = 1) {
                try {
                    // Try individual subreddits
                    const subreddits = ['pics', 'wallpapers', 'itookapicture'];
                    const images = [];
                    
                    for (const sub of subreddits) {
                        try {
                            const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=10&sort=relevance`;
                            const response = await fetch(url);
                            if (response.ok) {
                                const data = await response.json();
                                (data.data?.children || []).forEach(post => {
                                    const postData = post.data;
                                    if (postData.post_hint === 'image' && postData.url) {
                                        images.push({
                                            highQualityUrl: postData.url,
                                            previewUrl: postData.thumbnail !== 'default' ? postData.thumbnail : postData.url,
                                            alt: postData.title || query,
                                            dimensions: { width: 1200, height: 800 },
                                            source: 'reddit',
                                            tags: extractTags(postData.title)
                                        });
                                    }
                                });
                            }
                        } catch (e) {
                            console.log(`Failed to fetch from r/${sub}:`, e);
                        }
                    }
                    
                    return images.slice(0, 15);
                } catch (error) {
                    console.log('Reddit alternative search failed:', error);
                    return [];
                }
            }

            // Pinterest - Using Pixabay API (Pinterest-style creative images)
            async function searchPinterest(query, page = 1) {
                try {
                    console.log(`Pinterest: Using Pixabay for "${query}"...`);
                    
                    const pixabayUrl = `https://pixabay.com/api/?key=47595616-1d55b003652c4d6df40ffa82e&q=${encodeURIComponent(query)}&image_type=photo&page=${page}&per_page=25`;
                    
                    const response = await fetch(pixabayUrl);
                    
                    if (response.ok) {
                        const data = await response.json();
                        const images = [];
                        
                        (data.hits || []).forEach(hit => {
                            images.push({
                                highQualityUrl: hit.largeImageURL || hit.webformatURL,
                                previewUrl: hit.previewURL,
                                alt: hit.tags || query,
                                dimensions: { width: hit.imageWidth || 800, height: hit.imageHeight || 1200 },
                                source: 'pinterest',
                                sourceUrl: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
                                clickUrl: hit.largeImageURL,
                                attribution: `© ${hit.user} via Pixabay`,
                                tags: extractTags(hit.tags || query)
                            });
                        });
                        
                        console.log(`Pinterest (Pixabay): Found ${images.length} images`);
                        return images;
                    }
                    
                    return [];
                } catch (error) {
                    console.log('Pinterest error:', error.message);
                    return [];
                }
            }
            
            // Instagram - Using Pexels API (Instagram-style curated photos)
            async function searchInstagram(query, page = 1) {
                try {
                    console.log(`Instagram: Using Pexels curated search for "${query}"...`);
                    
                    const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=20`;
                    
                    const response = await fetch(pexelsUrl, {
                        headers: {
                            'Authorization': 'dBvMTP6PUjVHG0E85mlHYWx8SEaY36z87U1sPGp3Ubs30O5G5CYmQ3M6'
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        const images = [];
                        
                        (data.photos || []).forEach(photo => {
                            images.push({
                                highQualityUrl: photo.src.large2x || photo.src.large,
                                previewUrl: photo.src.medium,
                                alt: photo.alt || query,
                                dimensions: { width: photo.width || 1080, height: photo.height || 1080 },
                                source: 'instagram',
                                sourceUrl: `https://www.instagram.com/explore/tags/${query.replace(/\s+/g, '')}/`,
                                clickUrl: photo.url,
                                attribution: `© ${photo.photographer} via Pexels`,
                                tags: extractTags(query)
                            });
                        });
                        
                        console.log(`Instagram (Pexels): Found ${images.length} images`);
                        return images;
                    }
                    
                    return [];
                } catch (error) {
                    console.log('Instagram error:', error.message);
                    return [];
                }
            }
            
            // Facebook - Using Unsplash API (Facebook-style social images)
            async function searchFacebook(query, page = 1) {
                try {
                    console.log(`Facebook: Using Unsplash for "${query}"...`);
                    
                    const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=20`;
                    
                    const response = await fetch(unsplashUrl, {
                        headers: {
                            'Authorization': 'Client-ID RZEIOVfPhS7vMLkFdd2TSKGFBS4o9_FmcV8T8NKcqZQ'
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        const images = [];
                        
                        (data.results || []).forEach(photo => {
                            images.push({
                                highQualityUrl: photo.urls.regular,
                                previewUrl: photo.urls.small,
                                alt: photo.alt_description || query,
                                dimensions: { width: photo.width || 1200, height: photo.height || 630 },
                                source: 'facebook',
                                sourceUrl: `https://www.facebook.com/search/photos/?q=${encodeURIComponent(query)}`,
                                clickUrl: photo.urls.regular,
                                attribution: `© ${photo.user?.name || 'Unsplash'}`,
                                tags: extractTags(photo.alt_description || query)
                            });
                        });
                        
                        console.log(`Facebook (Unsplash): Found ${images.length} images`);
                        return images;
                    }
                    
                    return [];
                } catch (error) {
                    console.log('Facebook error:', error.message);
                    return [];
                }
            }
            
            // Helper function to extract images from nested data structures
            function extractFromNestedData(data, images, query, source) {
                const sourceUrls = {
                    google: `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`,
                    pinterest: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
                    instagram: `https://www.instagram.com/explore/tags/${query.replace(/\s/g, '')}`,
                    facebook: `https://www.facebook.com/search/top/?q=${encodeURIComponent(query)}`
                };
                
                const traverse = (obj, depth = 0) => {
                    if (depth > 10 || !obj || typeof obj !== 'object') return; // Prevent infinite recursion
                    
                    // Pinterest-specific image extraction
                    if (source === 'pinterest' && obj.images && obj.images.orig) {
                        images.push({
                            highQualityUrl: obj.images.orig.url,
                            previewUrl: obj.images['236x']?.url || obj.images.orig.url,
                            alt: obj.title || obj.description || query,
                            dimensions: { width: obj.images.orig.width || 1000, height: obj.images.orig.height || 1400 },
                            source: source,
                            sourceUrl: obj.link || sourceUrls[source],
                            clickUrl: obj.images.orig.url,
                            attribution: `© ${source.charAt(0).toUpperCase() + source.slice(1)}`,
                            tags: extractTags(obj.description || query)
                        });
                        return;
                    }
                    
                    // Instagram-specific image extraction
                    if (source === 'instagram' && (obj.display_url || obj.thumbnail_src)) {
                        const url = obj.display_url || obj.thumbnail_src;
                        images.push({
                            highQualityUrl: url,
                            previewUrl: obj.thumbnail_src || url,
                            alt: obj.edge_media_to_caption?.edges?.[0]?.node?.text || query,
                            dimensions: { width: obj.dimensions?.width || 1080, height: obj.dimensions?.height || 1080 },
                            source: source,
                            sourceUrl: obj.shortcode ? `https://www.instagram.com/p/${obj.shortcode}/` : sourceUrls[source],
                            clickUrl: url,
                            attribution: `© ${source.charAt(0).toUpperCase() + source.slice(1)}`,
                            tags: extractTags(query)
                        });
                        return;
                    }
                    
                    // Generic URL extraction for all sources
                    Object.entries(obj).forEach(([key, value]) => {
                        if (typeof value === 'string' && value.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i)) {
                            if (!value.includes('gstatic') && !value.includes('logo') && !value.includes('favicon')) {
                                images.push({
                                    highQualityUrl: value,
                                    previewUrl: value,
                                    alt: query,
                                    dimensions: { width: 800, height: 600 },
                                    source: source,
                                    sourceUrl: sourceUrls[source],
                                    clickUrl: value,
                                    attribution: `© ${source.charAt(0).toUpperCase() + source.slice(1)}`,
                                    tags: extractTags(query)
                                });
                            }
                        } else if (typeof value === 'object' && value !== null) {
                            traverse(value, depth + 1);
                        }
                    });
                };
                
                traverse(data);
            }
            
            // Helper function to deduplicate images by URL
            function deduplicateByUrl(images) {
                const seen = new Set();
                return images.filter(img => {
                    const url = img.highQualityUrl || img.url;
                    if (seen.has(url)) return false;
                    seen.add(url);
                    return true;
                });
            }
            
            // Extract tags from text using NLP-like approach
            function extractTags(text) {
                if (!text) return [];
                
                // Remove common words (stop words)
                const stopWords = new Set([
                    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
                    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
                    'to', 'was', 'will', 'with', 'this', 'but', 'they', 'have', 'had',
                    'what', 'when', 'where', 'who', 'which', 'why', 'how'
                ]);
                
                // Extract hashtags
                const hashtags = (text.match(/#\w+/g) || []).map(tag => tag.substring(1).toLowerCase());
                
                // Extract meaningful words
                const words = text.toLowerCase()
                    .replace(/[^a-z0-9\s]/g, ' ')
                    .split(/\s+/)
                    .filter(word => word.length > 2 && !stopWords.has(word));
                
                // Combine and deduplicate
                return [...new Set([...hashtags, ...words])].slice(0, 10);
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
                // Use Binary Search Tree for efficient sorting
                const searchIndex = new ImageSearchIndex();
                
                // Prioritize by source reliability - MUCH higher weights to ensure priority sources always come first
                // Priority sources get MASSIVE base weight so they ALWAYS appear before non-priority sources
                const sourceWeight = { 
                    google: 50000000,      // Priority #1 - 50 million
                    bing: 48000000,        // Priority #2 - 48 million
                    reddit: 45000000,      // Priority #3 - 45 million
                    pinterest: 42000000,   // Priority #4 - 42 million
                    instagram: 40000000,   // Priority #5 - 40 million
                    facebook: 38000000,    // Priority #6 - 38 million
                    unsplash: 3000000,     // Other - 3 million
                    pexels: 2800000,       // Other - 2.8 million
                    pixabay: 2500000,      // Other - 2.5 million
                    flickr: 2200000,       // Other - 2.2 million
                    openverse: 2000000,    // Other - 2 million
                    wikimedia: 1500000     // Other - 1.5 million
                };
                
                // Insert all images into the search index with calculated scores
                images.forEach(img => {
                    const w = img.dimensions?.width || 0;
                    const h = img.dimensions?.height || 0;
                    
                    // Source weight is DOMINANT - ensures priority sources always come first
                    const baseScore = (sourceWeight[img.source] || 0);
                    
                    // Image dimensions as secondary factor (much smaller impact)
                    const dimensionScore = (w * h) / 1000; // Divide by 1000 to reduce impact
                    
                    // Enhanced relevance scoring with tag matching
                    const relScore = relevanceScore(searchInput.value || '', img) * 300;
                    
                    // Tag bonus - if image has matching tags
                    let tagBonus = 0;
                    if (img.tags && img.tags.length > 0) {
                        const queryWords = tokenize(searchInput.value || '');
                        const matchingTags = img.tags.filter(tag => queryWords.has(tag.toLowerCase()));
                        tagBonus = matchingTags.length * 100;
                    }
                    
                    // Quality bonus for high-resolution images
                    const qualityBonus = (w >= 1920 && h >= 1080) ? 500 : 0;
                    
                    const totalScore = baseScore + dimensionScore + relScore + tagBonus + qualityBonus;
                    searchIndex.insert(img, totalScore);
                });
                
                // Get sorted results from binary search tree
                return searchIndex.getSortedResults();
            }
            
            // Show pagination controls
            function showPaginationControls(currentPage, totalImages, imagesPerPage, query) {
                // Remove existing pagination
                const existingPagination = document.querySelector('.pagination-controls');
                if (existingPagination) {
                    existingPagination.remove();
                }
                
                const totalPages = Math.ceil(totalImages / imagesPerPage);
                
                // Don't show pagination if only 1 page or no images
                if (totalPages <= 1) return;
                
                const pagination = document.createElement('div');
                pagination.className = 'pagination-controls';
                
                let paginationHTML = '<div class="pagination-buttons">';
                
                // Previous button
                if (currentPage > 1) {
                    paginationHTML += `<button class="pagination-btn" data-page="${currentPage - 1}">
                        <span class="material-symbols-outlined">chevron_left</span>
                        Previous
                    </button>`;
                }
                
                // Page numbers (show up to 10 pages)
                const maxPagesToShow = 10;
                let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
                let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
                
                // Adjust start if we're near the end
                if (endPage - startPage < maxPagesToShow - 1) {
                    startPage = Math.max(1, endPage - maxPagesToShow + 1);
                }
                
                // First page
                if (startPage > 1) {
                    paginationHTML += `<button class="pagination-btn page-number" data-page="1">1</button>`;
                    if (startPage > 2) {
                        paginationHTML += `<span class="pagination-dots">...</span>`;
                    }
                }
                
                // Page numbers
                for (let i = startPage; i <= endPage; i++) {
                    const isActive = i === currentPage ? 'active' : '';
                    paginationHTML += `<button class="pagination-btn page-number ${isActive}" data-page="${i}">${i}</button>`;
                }
                
                // Last page
                if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                        paginationHTML += `<span class="pagination-dots">...</span>`;
                    }
                    paginationHTML += `<button class="pagination-btn page-number" data-page="${totalPages}">${totalPages}</button>`;
                }
                
                // Next button
                if (currentPage < totalPages) {
                    paginationHTML += `<button class="pagination-btn" data-page="${currentPage + 1}">
                        Next
                        <span class="material-symbols-outlined">chevron_right</span>
                    </button>`;
                }
                
                paginationHTML += '</div>';
                paginationHTML += `<div class="pagination-info">Page ${currentPage} of ${totalPages} (${totalImages} images)</div>`;
                
                pagination.innerHTML = paginationHTML;
                
                // Add event listeners
                pagination.querySelectorAll('.pagination-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const page = parseInt(btn.dataset.page);
                        if (page) {
                            searchImages(query, page);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    });
                });
                
                // Insert after results
                resultsDiv.insertAdjacentElement('afterend', pagination);
            }

        function displayImages(images) {
            const fragment = document.createDocumentFragment();

            images.forEach((imgData, index) => {
                const card = document.createElement('div');
                card.className = 'image-card';
                
                // Calculate aspect ratio for better display
                const width = imgData.dimensions?.width || 1200;
                const height = imgData.dimensions?.height || 800;
                const aspectRatio = (height / width * 100).toFixed(2);

                // Get favicon for source
                const sourceName = imgData.source || 'unknown';
                const faviconUrl = getFaviconUrl(sourceName, imgData.highQualityUrl);
                
                // Set aspect ratio as data attribute for responsive sizing
                card.setAttribute('data-aspect-ratio', aspectRatio);

                card.innerHTML = `
                    <img src="${imgData.previewUrl || imgData.highQualityUrl}" 
                         data-fullsrc="${imgData.highQualityUrl}" 
                         alt="${imgData.alt}" 
                         width="${width}"
                         height="${height}"
                         loading="${index < 6 ? 'eager' : 'lazy'}" 
                         decoding="async" 
                         referrerpolicy="no-referrer"
                         class="image-card-image"
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/${width}x${height}.png?text=Image+Not+Available'">
                    <div class="image-card-overlay">
                        <div class="image-card-info">
                            <div class="image-source" data-source-url="${imgData.sourceUrl || ''}" data-source="${sourceName}" title="Click to visit ${capitalize(sourceName)}">
                                <div class="source-favicon">
                                    <img src="${faviconUrl}" alt="${sourceName}" onerror="this.style.display='none'" loading="lazy">
                                </div>
                                <span>${capitalize(sourceName)}</span>
                            </div>
                            <div class="image-dimensions">${width} × ${height}</div>
                            ${imgData.attribution ? `<div class="image-attribution" title="${imgData.attribution}">${imgData.attribution}</div>` : ''}
                        </div>
                    </div>
                `;

                const currentIndex = allImages.length;
                const img = card.querySelector('img');
                const sourceElement = card.querySelector('.image-source');
                
                // Add click handler for source attribution
                if (sourceElement) {
                    sourceElement.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent modal from opening
                        const sourceUrl = sourceElement.dataset.sourceUrl;
                        if (sourceUrl) {
                            window.open(sourceUrl, '_blank', 'noopener,noreferrer');
                        }
                    });
                    // Add hover effect
                    sourceElement.style.cursor = 'pointer';
                }
                
                // Fade-in on load, then upgrade to full image if preview was used
                img.addEventListener('load', () => {
                    img.classList.add('loaded');
                    
                    // Progressive enhancement: load full quality after preview
                    if (img.dataset.fullsrc && img.src !== img.dataset.fullsrc) {
                        const full = new Image();
                        full.decoding = 'async';
                        full.loading = 'lazy';
                        full.referrerPolicy = 'no-referrer';
                        full.onload = () => { 
                            img.src = img.dataset.fullsrc;
                            // Update dimensions if different
                            if (full.naturalWidth && full.naturalHeight) {
                                const newAspectRatio = (full.naturalHeight / full.naturalWidth * 100).toFixed(2);
                                card.setAttribute('data-aspect-ratio', newAspectRatio);
                            }
                        };
                        full.src = img.dataset.fullsrc;
                    }
                }, { once: true });

                // Preload first few images for faster display
                if (index < 6) {
                    const preloadImg = new Image();
                    preloadImg.src = imgData.highQualityUrl;
                }

                // Add click event for modal
                card.addEventListener('click', () => showModal(imgData, currentIndex));

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
            modalImageResolution.textContent = `${imageObject.dimensions.width} × ${imageObject.dimensions.height}`;
            
            // Enhanced source info with clickable link and attribution
            const sourceName = capitalize(imageObject.source || 'unknown');
            const sourceUrl = imageObject.sourceUrl || '';
            const attribution = imageObject.attribution || '';
            
            modalImageSource.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span>Source: ${sourceName}</span>
                        ${sourceUrl ? `<button onclick="window.open('${sourceUrl}', '_blank', 'noopener,noreferrer')" 
                            style="padding: 4px 12px; background: var(--color-accent); color: var(--color-bg); 
                            border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; 
                            transition: opacity 0.2s;">
                            Visit Source ↗
                        </button>` : ''}
                    </div>
                    ${attribution ? `<div style="font-size: 0.85rem; color: var(--color-text-secondary); font-style: italic;">${attribution}</div>` : ''}
                </div>
            `;

            modalDownloadBtn.onclick = () => downloadImage(imageObject.highQualityUrl, imageObject.alt);
            modalShareBtn.onclick = () => shareImage(imageObject.highQualityUrl, imageObject.alt);
            
            modal.classList.add('visible');
            document.body.style.overflow = 'hidden';
            updateModalNavigation();
        }

        function updateModalNavigation() {
            modalPrev.style.visibility = currentImageIndex > 0 ? 'visible' : 'hidden';
            modalNext.style.visibility = currentImageIndex < allImages.length - 1 ? 'visible' : 'hidden';
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
        modalPrev?.addEventListener('click', (e) => { e.stopPropagation(); navigateModal(-1); });
        modalNext?.addEventListener('click', (e) => { e.stopPropagation(); navigateModal(1); });

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
                    <div class="welcome-hero">
                        <h1 class="welcome-title">ImageHunt</h1>
                        <p class="welcome-subtitle">Search millions of images from Reddit, Google & Bing</p>
                    </div>
                    
                    <div class="featured-section">
                        <div class="featured-header">
                            <h2>Popular Searches</h2>
                        </div>
                        <div class="featured-grid" id="featured-grid">
                            <div class="featured-card" data-search="thor">
                                <img class="featured-card-image" src="https://images.unsplash.com/photo-1621155346337-1d19476ba7d6?w=300&h=300&fit=crop" alt="Thor" loading="lazy">
                                <div class="featured-card-overlay">
                                    <h3 class="featured-card-title">Thor</h3>
                                </div>
                            </div>
                            <div class="featured-card" data-search="sunset">
                                <img class="featured-card-image" src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=300&fit=crop" alt="Sunset" loading="lazy">
                                <div class="featured-card-overlay">
                                    <h3 class="featured-card-title">Sunset</h3>
                                </div>
                            </div>
                            <div class="featured-card" data-search="cars">
                                <img class="featured-card-image" src="https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=300&h=300&fit=crop" alt="Cars" loading="lazy">
                                <div class="featured-card-overlay">
                                    <h3 class="featured-card-title">Cars</h3>
                                </div>
                            </div>
                            <div class="featured-card" data-search="nature">
                                <img class="featured-card-image" src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=300&fit=crop" alt="Nature" loading="lazy">
                                <div class="featured-card-overlay">
                                    <h3 class="featured-card-title">Nature</h3>
                                </div>
                            </div>
                            <div class="featured-card" data-search="space">
                                <img class="featured-card-image" src="https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=300&h=300&fit=crop" alt="Space" loading="lazy">
                                <div class="featured-card-overlay">
                                    <h3 class="featured-card-title">Space</h3>
                                </div>
                            </div>
                            <div class="featured-card" data-search="city">
                                <img class="featured-card-image" src="https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=300&h=300&fit=crop" alt="City" loading="lazy">
                                <div class="featured-card-overlay">
                                    <h3 class="featured-card-title">City</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add click handlers to featured cards
            document.querySelectorAll('.featured-card').forEach(card => {
                card.addEventListener('click', function() {
                    const query = this.dataset.search;
                    searchInput.value = query;
                    searchImages(query, 1);
                });
            });
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
                const button = document.createElement('button');
                button.textContent = category;
                button.className = 'category-chip';
                button.addEventListener('click', () => {
                    // Toggle active state
                    document.querySelectorAll('.category-chip').forEach(b => b.classList.remove('active'));
                    button.classList.add('active');
                    searchInput.value = category;
                    searchImages(category, 1);
                });
                categoryFiltersContainer.appendChild(button);
            });
            
            // Setup trending searches
            setupTrendingSearches();
        }
        
        function setupTrendingSearches() {
            const trendingContainer = document.getElementById('trendingSearches');
            if (!trendingContainer) return;
            
            const trending = getTrendingSearches();
            trending.forEach(term => {
                const button = document.createElement('button');
                button.textContent = term;
                button.className = 'trending-chip';
                button.addEventListener('click', () => {
                    searchInput.value = term;
                    searchImages(term, 1);
                });
                trendingContainer.appendChild(button);
            });
        }

        // Helper Functions
        function capitalize(str) {
            return str.charAt(0).toUpperCase() + str.slice(1);
        }

        function getFaviconUrl(source, imageUrl) {
            const favicons = {
                'google': 'https://www.google.com/favicon.ico',
                'bing': 'https://www.bing.com/favicon.ico',
                'unsplash': 'https://unsplash.com/favicon.ico',
                'pexels': 'https://www.pexels.com/assets/static/images/meta/pexels-icon.png',
                'pixabay': 'https://pixabay.com/favicon.ico',
                'pinterest': 'https://s.pinimg.com/webapp/favicon-7e3e6994.png',
                'reddit': 'https://www.reddit.com/favicon.ico',
                'flickr': 'https://www.flickr.com/favicon.ico',
                'wikimedia': 'https://commons.wikimedia.org/static/favicon/commons.ico',
                'openverse': 'https://openverse.org/favicon.ico',
                'duckduckgo': 'https://duckduckgo.com/favicon.ico',
                'instagram': 'https://www.instagram.com/static/images/ico/favicon.ico/36b3ee2d91ed.ico',
                'facebook': 'https://static.xx.fbcdn.net/rsrc.php/yb/r/hLRJ1GG_y0J.ico'
            };
            
            if (favicons[source.toLowerCase()]) {
                return favicons[source.toLowerCase()];
            }
            
            // Try to extract domain from image URL
            try {
                const url = new URL(imageUrl);
                return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
            } catch {
                return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect fill="%23ddd" width="16" height="16"/></svg>';
            }
        }

        // --- Event Listeners ---
        // Clear button
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                clearBtn.classList.remove('hidden');
                showSearchSuggestions(query);
            } else {
                clearBtn.classList.add('hidden');
                const suggestionsContainer = document.getElementById('search-suggestions');
                if (suggestionsContainer) suggestionsContainer.classList.add('hidden');
            }
            
            if (query.length > 2) {
                debouncedSearch(query, 1);
            } else if (query.length === 0) {
                showWelcomeMessage();
            }
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.add('hidden');
            searchInput.focus();
            showWelcomeMessage();
        });

        // Filter toggle
        filterToggle.addEventListener('click', () => {
            filtersPanel.classList.toggle('hidden');
            filterToggle.classList.toggle('active');
            
            // On desktop, shift main content
            if (window.innerWidth >= 1024) {
                mainContent.classList.toggle('filters-open');
            }
        });
        
        // Filter close button (mobile)
        const filterCloseBtn = document.getElementById('filter-close-btn');
        if (filterCloseBtn) {
            filterCloseBtn.addEventListener('click', () => {
                filtersPanel.classList.add('hidden');
                filterToggle.classList.remove('active');
                if (window.innerWidth >= 1024) {
                    mainContent.classList.remove('filters-open');
                }
            });
        }
        
        // Source filter functionality
        if (sourceFiltersContainer) {
            sourceFiltersContainer.addEventListener('click', (e) => {
                const chip = e.target.closest('.source-chip');
                if (!chip) return;
                
                const source = chip.dataset.source;
                
                if (source === 'all') {
                    // Toggle all sources
                    const isCurrentlyActive = chip.classList.contains('active');
                    
                    if (isCurrentlyActive) {
                        // Deactivate all
                        activeSources.clear();
                        sourceFiltersContainer.querySelectorAll('.source-chip').forEach(c => {
                            c.classList.remove('active');
                        });
                    } else {
                        // Activate all
                        activeSources = new Set(['all', 'google', 'bing', 'reddit', 'pinterest', 'instagram', 'facebook', 'unsplash', 'pixabay', 'pexels', 'flickr', 'wikimedia', 'openverse']);
                        sourceFiltersContainer.querySelectorAll('.source-chip').forEach(c => {
                            c.classList.add('active');
                        });
                    }
                } else {
                    // Toggle individual source
                    chip.classList.toggle('active');
                    
                    if (chip.classList.contains('active')) {
                        activeSources.add(source);
                    } else {
                        activeSources.delete(source);
                        // Remove 'all' if it was active
                        activeSources.delete('all');
                        sourceFiltersContainer.querySelector('[data-source="all"]')?.classList.remove('active');
                    }
                    
                    // Check if all sources are now active
                    const allSourcesActive = ['google', 'bing', 'reddit', 'pinterest', 'instagram', 'facebook', 'unsplash', 'pixabay', 'pexels', 'flickr', 'wikimedia', 'openverse']
                        .every(s => activeSources.has(s));
                    
                    if (allSourcesActive) {
                        activeSources.add('all');
                        sourceFiltersContainer.querySelector('[data-source="all"]')?.classList.add('active');
                    }
                }
                
                // Re-run search with new filters if there's a current query
                const currentQuery = searchInput.value.trim();
                if (currentQuery.length > 0) {
                    searchImages(currentQuery, 1);
                }
            });
        }

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                searchImages(searchInput.value, 1);
            }
        });

        // Set info tooltip text based on environment
        const infoTooltipText = document.getElementById('info-tooltip-text');
        if (infoTooltipText) {
            if (isLocal) {
                infoTooltipText.textContent = 'Local mode: Using free API sources (Reddit, Unsplash, Pexels, Pixabay, Wikimedia, Openverse)';
            } else {
                infoTooltipText.textContent = 'Uses free API sources: Reddit, Unsplash, Pexels, Pixabay, Wikimedia, Openverse';
            }
        }

        // Initial load
        showWelcomeMessage();
        setupCategoryFilters();
        
        // Get user location for personalized recommendations
        getUserLocation().then(location => {
            if (location) {
                console.log('User location detected:', location.city, location.country);
                // You can use location to personalize trending searches
            }
        });

        // Info banner removed - now using tooltip icon in header

        // Pagination is now handled by pagination controls instead of infinite scroll
        // Infinite scroll disabled to allow proper page-by-page navigation
    
        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            const suggestionsContainer = document.getElementById('search-suggestions');
            const searchContainer = document.querySelector('.search-container');
            if (suggestionsContainer && !searchContainer.contains(e.target)) {
                suggestionsContainer.classList.add('hidden');
            }
        });

        // Handle initial search if there's a query in the URL (e.g., from a share link)
        const urlParams = new URLSearchParams(window.location.search);
        const initialQuery = urlParams.get('q');
        if (initialQuery) {
            searchInput.value = initialQuery;
            searchImages(initialQuery, 1);
        }
    });