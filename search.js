document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');

    if (query) {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = query;
        }
        // The main script.js will handle the search execution
    }

    const resultsContainer = document.getElementById('results');
    if (resultsContainer) {
        // Example: Dynamically add search items
        for (let i = 0; i < 10; i++) {
            const item = document.createElement('div');
            item.className = 'search-item';
            item.textContent = `Result ${i + 1}`;
            resultsContainer.appendChild(item);
        }
    }
});