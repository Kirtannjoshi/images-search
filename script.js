const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const modal = document.getElementById('imageModal');
const modalImg = document.getElementById('modalImage');
const closeModal = document.querySelector('.close-modal');
const prevButton = document.querySelector('.modal-prev');
const nextButton = document.querySelector('.modal-next');
const showFavoritesButton = document.getElementById('showFavoritesButton');

let currentImageIndex = 0;
let allImages = [];
const favorites = new Set();

const categories = ['Nature', 'Architecture', 'Food', 'Technology', 'Art'];

function extractHighQualityUrl(imgElement) {
    const dataSrc = imgElement.getAttribute('data-src');
    const originalSrc = imgElement.getAttribute('data-original');
    const src = imgElement.src;
    
    let highQualityUrl = dataSrc || originalSrc || src;
    
    highQualityUrl = highQualityUrl
        .replace(/\bw=\d+\b/g, 'w=1920')
        .replace(/\bh=\d+\b/g, 'h=1080')
        .replace(/\bq=\d+\b/g, 'q=100')
        .replace(/size=\w+/g, 'size=large')
        .replace(/width=\d+/g, 'width=1920')
        .replace(/height=\d+/g, 'height=1080');

    return highQualityUrl;
}

async function validateImage(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (e) {
        return false;
    }
}

async function getImageDimensions(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            resolve({ width: this.width, height: this.height });
        };
        img.onerror = function() {
            resolve({ width: 0, height: 0 });
        };
        img.src = url;
    });
}

function showModal(imageElement, index) {
    currentImageIndex = index;
    modalImg.src = imageElement.getAttribute('data-full');
    modal.style.display = 'block';
    updateModalNavigation();
}

function updateModalNavigation() {
    prevButton.style.display = currentImageIndex > 0 ? 'flex' : 'none';
    nextButton.style.display = currentImageIndex < allImages.length - 1 ? 'flex' : 'none';
}

function navigateModal(direction) {
    currentImageIndex += direction;
    if (currentImageIndex >= 0 && currentImageIndex < allImages.length) {
        const nextImage = allImages[currentImageIndex];
        modalImg.src = nextImage.getAttribute('data-full');
        updateModalNavigation();
    }
}

async function searchImages(query, page = 1) {
    if (!query) {
        showWelcomeMessage();
        return;
    }

    if (page === 1) {
        showSkeletonLoading();
        resultsDiv.innerHTML = '';
        allImages = [];
    }

    const fragment = document.createDocumentFragment();

    loadingDiv.classList.remove('hidden');

    try {
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const searchUrls = [
            `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&tbs=isz:l`,
            `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&qft=+filterui:imagesize-large`,
            `https://yandex.com/images/search?text=${encodeURIComponent(query)}&isize=large`
        ];

        for (const searchUrl of searchUrls) {
            try {
                const response = await fetch(proxyUrl + encodeURIComponent(searchUrl));
                if (!response.ok) continue;

                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                const imageElements = Array.from(doc.querySelectorAll('img[src], img[data-src]'));
                
                for (const img of imageElements) {
                    const highQualityUrl = extractHighQualityUrl(img);
                    
                    if (await validateImage(highQualityUrl)) {
                        const dimensions = await getImageDimensions(highQualityUrl);
                        
                        if (dimensions.width >= 500 || dimensions.height >= 500) {
                        const card = createImageCard(highQualityUrl, img.alt || 'Image', dimensions.width, dimensions.height);
                        const cardImg = card.querySelector('img');
                        allImages.push(cardImg);
                        const currentIndex = allImages.length - 1;
                        cardImg.addEventListener('click', () => showModal(cardImg, currentIndex));
                        fragment.appendChild(card);
                    }
                    }
                }

                if (fragment.children.length > 0) {
                    resultsDiv.appendChild(fragment);
                    break;
                }
            } catch (error) {
                console.error('Error with source:', error);
                continue;
            }
        }

        if (resultsDiv.children.length === 0) {
            showNoResults();
        }

    } catch (error) {
        console.error('Error:', error);
        showError();
    } finally {
        loadingDiv.classList.add('hidden');
    }
}

// Event Listeners
closeModal.onclick = () => modal.style.display = "none";
modal.onclick = (event) => {
    if (event.target === modal) {
        modal.style.display = "none";
    }
};

prevButton.onclick = (e) => {
    e.stopPropagation();
    navigateModal(-1);
};

nextButton.onclick = (e) => {
    e.stopPropagation();
    navigateModal(1);
};

document.addEventListener('keydown', (e) => {
    if (modal.style.display === 'block') {
        if (e.key === 'ArrowLeft') navigateModal(-1);
        if (e.key === 'ArrowRight') navigateModal(1);
        if (e.key === 'Escape') modal.style.display = 'none';
    }
});

// Helper functions for UI messages
function showWelcomeMessage() {
    resultsDiv.innerHTML = `
        <div class="welcome-message" style="text-align: center; padding: 40px;">
            <h2 style="color: #4CAF50; margin-bottom: 20px;">Welcome to Universal Image Search</h2>
            <p style="color: #fff; font-size: 1.2em;">Enter any search term to find high-quality images</p>
            <p style="color: #888; margin-top: 10px;">Images will maintain their original aspect ratios</p>
        </div>
    `;
}

function showNoResults() {
    resultsDiv.innerHTML = `
        <div class="error-message" style="text-align: center; padding: 40px;">
            <h3 style="color: #ff6b6b; margin-bottom: 20px;">No images found</h3>
            <p style="color: #fff;">Try different search terms or check your spelling</p>
        </div>
    `;
}

function showError() {
    resultsDiv.innerHTML = `
        <div class="error-message" style="text-align: center; padding: 40px;">
            <h3 style="color: #ff6b6b; margin-bottom: 20px;">Error fetching images</h3>
            <p style="color: #fff; margin-bottom: 15px;">Please try:</p>
            <ul style="list-style: none; color: #ddd;">
                <li style="margin: 10px 0;">✓ Checking your internet connection</li>
                <li style="margin: 10px 0;">✓ Using different search terms</li>
                <li style="margin: 10px 0;">✓ Waiting a few minutes and trying again</li>
            </ul>
        </div>
    `;
}

// Debounce function
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};

// Search event listeners
const debouncedSearch = debounce(searchImages, 500);

searchButton.addEventListener('click', () => {
    searchImages(searchInput.value);
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchImages(searchInput.value);
    }
});

// Initialize
window.addEventListener('load', () => {
    showWelcomeMessage();
    addCategoryFilter();
    addFilterButtons();
});

showFavoritesButton.addEventListener('click', showFavorites);

// Handle image loading errors
window.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG') {
        e.target.src = 'https://via.placeholder.com/800x600.png?text=Image+Not+Available';
    }
}, true);

// Download function
async function downloadImage(url, filename) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename + '.jpg';
        link.click();
        window.URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Download failed:', error);
    }
}

// Show skeleton loading
function showSkeletonLoading() {
    const skeletonHTML = Array(10).fill(`
        <div class="skeleton-card skeleton"></div>
    `).join('');
    resultsDiv.innerHTML = skeletonHTML;
}

// Infinite scroll
let isLoading = false;
let currentPage = 1;

async function loadMoreImages() {
    if (isLoading) return;
    
    const scrollPosition = window.innerHeight + window.scrollY;
    const scrollThreshold = document.documentElement.scrollHeight - 1000;
    
    if (scrollPosition > scrollThreshold) {
        isLoading = true;
        currentPage++;
        await searchImages(searchInput.value, currentPage);
        isLoading = false;
    }
}

// Add scroll event listener
window.addEventListener('scroll', debounce(loadMoreImages, 200));

function addToFavorites(imageUrl) {
    favorites.add(imageUrl);
    localStorage.setItem('favorites', JSON.stringify([...favorites]));
}

function showFavorites() {
    const savedFavorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    resultsDiv.innerHTML = '';
    if (savedFavorites.length === 0) {
        resultsDiv.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 40px;">
                <h3 style="color: #ff6b6b; margin-bottom: 20px;">No favorites yet!</h3>
                <p style="color: #fff;">Add some images to your favorites to see them here.</p>
            </div>
        `;
        return;
    }
    savedFavorites.forEach(url => {
        const card = createImageCard(url, 'Favorite Image', 0, 0); // Dimensions can be fetched if needed
        resultsDiv.appendChild(card);
    });
}

function addFavoriteButton(card, imageUrl) {
    const favBtn = document.createElement('button');
    favBtn.className = 'favorite-btn';
    favBtn.innerHTML = 'Add to Favorites';
    favBtn.onclick = () => {
        addToFavorites(imageUrl);
        favBtn.textContent = 'Added!';
        favBtn.disabled = true;
    };
    card.querySelector('.image-info').appendChild(favBtn);
}

function addShareButton(card, imageUrl) {
    const shareBtn = document.createElement('button');
    shareBtn.className = 'share-btn';
    shareBtn.innerHTML = 'Share';
    shareBtn.onclick = async () => {
        try {
            await navigator.share({
                title: 'Check out this image',
                text: 'Found this amazing image!',
                url: imageUrl
            });
        } catch (err) {
            console.error('Share failed:', err);
        }
    };
    card.querySelector('.image-info').appendChild(shareBtn);
}

function addCategoryFilter() {
    const filterContainer = document.createElement('div');
    filterContainer.className = 'category-filters';
    categories.forEach(category => {
        const button = document.createElement('button');
        button.textContent = category;
        button.onclick = () => searchImages(category);
        filterContainer.appendChild(button);
    });
    document.querySelector('header').appendChild(filterContainer);
}

function applyImageFilter(image, filter) {
    const filters = {
        grayscale: 'grayscale(100%)',
        sepia: 'sepia(100%)',
        blur: 'blur(5px)',
        brightness: 'brightness(150%)'
    };
    image.style.filter = filters[filter];
}

function addFilterButtons() {
    const filterNames = ['grayscale', 'sepia', 'blur', 'brightness'];
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-buttons';
    filterNames.forEach(filter => {
        const button = document.createElement('button');
        button.textContent = filter.charAt(0).toUpperCase() + filter.slice(1);
        button.onclick = () => {
            document.querySelectorAll('.image-card img').forEach(img => {
                applyImageFilter(img, filter);
            });
        };
        filterContainer.appendChild(button);
    });
    document.querySelector('header').appendChild(filterContainer);
}

function createImageCard(imageUrl, altText, width, height) {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.innerHTML = `
        <div class="image-container">
            <img src="${imageUrl}" 
                 alt="${altText}"
                 data-full="${imageUrl}"
                 onerror="this.onerror=null; this.src='https://via.placeholder.com/800x600.png?text=Image+Not+Available'">
        </div>
        <div class="image-info">
            <div class="image-title">${altText}</div>
            <div class="image-resolution">${width}x${height}</div>
            <button class="download-btn" onclick="downloadImage('${imageUrl}', '${altText.replace(/[^a-z0-9]/gi, '_')}')">
                Download
            </button>
        </div>
    `;
    addShareButton(card, imageUrl);
    addFavoriteButton(card, imageUrl);
    return card;
}