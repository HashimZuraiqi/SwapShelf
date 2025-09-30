/**
 * Dashboard Real-time Data Updates
 * Handles AJAX calls to refresh dashboard data without page reload
 */

class DashboardUpdater {
    constructor() {
        this.updateInterval = 30000; // 30 seconds
        this.isUpdating = false;
        this.lastUpdate = Date.now();
        
        this.initializeUpdates();
        this.bindEvents();
    }
    
    /**
     * Initialize automatic updates
     */
    initializeUpdates() {
        // Auto-refresh every 30 seconds when page is visible
        this.autoUpdateInterval = setInterval(() => {
            if (document.visibilityState === 'visible' && !this.isUpdating) {
                this.refreshStats();
            }
        }, this.updateInterval);
        
        // Pause updates when page is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // Resume updates when page becomes visible again
                const timeSinceLastUpdate = Date.now() - this.lastUpdate;
                if (timeSinceLastUpdate > this.updateInterval) {
                    this.refreshStats();
                }
            }
        });
    }
    
    /**
     * Bind UI events
     */
    bindEvents() {
        // Manual refresh button
        const refreshBtn = document.getElementById('refresh-dashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.refreshAllData();
            });
        }
        
        // Individual section refresh buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('refresh-stats')) {
                e.preventDefault();
                this.refreshStats();
            }
            if (e.target.classList.contains('refresh-insights')) {
                e.preventDefault();
                this.refreshInsights();
            }
            if (e.target.classList.contains('refresh-nearby')) {
                e.preventDefault();
                this.refreshNearbyBooks();
            }
            if (e.target.classList.contains('refresh-trending')) {
                e.preventDefault();
                this.refreshTrending();
            }
        });
    }
    
    /**
     * Show loading state for a section
     */
    showLoading(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('loading');
            const content = section.querySelector('.card-body, .stats-inner');
            if (content) {
                content.style.opacity = '0.6';
            }
        }
    }
    
    /**
     * Hide loading state for a section
     */
    hideLoading(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.remove('loading');
            const content = section.querySelector('.card-body, .stats-inner');
            if (content) {
                content.style.opacity = '1';
            }
        }
    }
    
    /**
     * Show error message
     */
    showError(message, sectionId = null) {
        console.error('Dashboard update error:', message);
        
        // You could implement a toast notification here
        if (sectionId) {
            const section = document.getElementById(sectionId);
            if (section) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'alert alert-danger alert-dismissible fade show mt-2';
                errorDiv.innerHTML = `
                    ${message}
                    <button type="button" class="close" data-dismiss="alert">
                        <span>&times;</span>
                    </button>
                `;
                section.appendChild(errorDiv);
                
                // Auto-remove after 5 seconds
                setTimeout(() => {
                    if (errorDiv.parentNode) {
                        errorDiv.remove();
                    }
                }, 5000);
            }
        }
    }
    
    /**
     * Refresh user statistics
     */
    async refreshStats() {
        if (this.isUpdating) return;
        
        try {
            this.isUpdating = true;
            this.showLoading('user-stats-section');
            
            const response = await fetch('/api/dashboard/stats');
            if (!response.ok) throw new Error('Failed to fetch stats');
            
            const stats = await response.json();
            this.updateStatsUI(stats);
            this.lastUpdate = Date.now();
            
        } catch (error) {
            this.showError('Failed to update statistics', 'user-stats-section');
        } finally {
            this.hideLoading('user-stats-section');
            this.isUpdating = false;
        }
    }
    
    /**
     * Refresh swap insights
     */
    async refreshInsights() {
        try {
            this.showLoading('swap-insights-section');
            
            const response = await fetch('/api/dashboard/insights');
            if (!response.ok) throw new Error('Failed to fetch insights');
            
            const insights = await response.json();
            this.updateInsightsUI(insights);
            
        } catch (error) {
            this.showError('Failed to update insights', 'swap-insights-section');
        } finally {
            this.hideLoading('swap-insights-section');
        }
    }
    
    /**
     * Refresh nearby books
     */
    async refreshNearbyBooks() {
        try {
            this.showLoading('nearby-books-section');
            
            const response = await fetch('/api/dashboard/nearby');
            if (!response.ok) throw new Error('Failed to fetch nearby books');
            
            const books = await response.json();
            this.updateNearbyBooksUI(books);
            
        } catch (error) {
            this.showError('Failed to update nearby books', 'nearby-books-section');
        } finally {
            this.hideLoading('nearby-books-section');
        }
    }
    
    /**
     * Refresh trending data
     */
    async refreshTrending() {
        try {
            this.showLoading('trending-section');
            
            const response = await fetch('/api/dashboard/trending');
            if (!response.ok) throw new Error('Failed to fetch trending data');
            
            const trending = await response.json();
            this.updateTrendingUI(trending);
            
        } catch (error) {
            this.showError('Failed to update trending data', 'trending-section');
        } finally {
            this.hideLoading('trending-section');
        }
    }
    
    /**
     * Refresh all dashboard data
     */
    async refreshAllData() {
        if (this.isUpdating) return;
        
        try {
            this.isUpdating = true;
            
            // Show loading for all sections
            ['user-stats-section', 'swap-insights-section', 'nearby-books-section', 'trending-section'].forEach(id => {
                this.showLoading(id);
            });
            
            const response = await fetch('/api/dashboard/refresh');
            if (!response.ok) throw new Error('Failed to refresh dashboard');
            
            const data = await response.json();
            
            // Update all UI sections
            this.updateStatsUI(data.userStats);
            this.updateInsightsUI(data.swapInsights);
            this.updateNearbyBooksUI(data.nearbyBooks);
            this.updateTrendingUI({ genres: data.trendingGenres, books: data.trendingBooks });
            
            this.lastUpdate = Date.now();
            
        } catch (error) {
            this.showError('Failed to refresh dashboard data');
        } finally {
            // Hide loading for all sections
            ['user-stats-section', 'swap-insights-section', 'nearby-books-section', 'trending-section'].forEach(id => {
                this.hideLoading(id);
            });
            this.isUpdating = false;
        }
    }
    
    /**
     * Update statistics UI
     */
    updateStatsUI(stats) {
        const updateStat = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                // Animate the number change
                const currentValue = parseInt(element.textContent) || 0;
                this.animateNumber(element, currentValue, value);
            }
        };
        
        updateStat('books-owned-count', stats.booksOwned);
        updateStat('swaps-completed-count', stats.swapsCompleted);
        updateStat('wishlist-items-count', stats.wishlistItems);
        updateStat('pending-swaps-count', stats.pendingSwaps);
    }
    
    /**
     * Update insights UI
     */
    updateInsightsUI(insights) {
        const successRateElement = document.getElementById('success-rate');
        const responseTimeElement = document.getElementById('avg-response-time');
        const popularGenreElement = document.getElementById('popular-genre');
        
        if (successRateElement) {
            this.animateNumber(successRateElement, parseInt(successRateElement.textContent) || 0, insights.successRate);
        }
        
        if (responseTimeElement) {
            responseTimeElement.textContent = insights.avgResponseTime;
        }
        
        if (popularGenreElement) {
            popularGenreElement.textContent = insights.popularGenre;
        }
    }
    
    /**
     * Update nearby books UI
     */
    updateNearbyBooksUI(books) {
        const container = document.getElementById('nearby-books-list');
        if (!container) return;
        
        if (books.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No nearby books available at the moment.</p></div>';
            return;
        }
        
        container.innerHTML = books.map(book => `
            <div class="nearby-book-item">
                <div class="row align-items-center">
                    <div class="col-3">
                        <img src="${book.image}" alt="${book.title}" class="img-fluid rounded" style="max-height: 80px;">
                    </div>
                    <div class="col-9">
                        <h6 class="mb-1 text-white">${book.title}</h6>
                        <p class="mb-1 text-muted small">by ${book.author}</p>
                        <small class="text-info">${book.distance} • ${book.condition}</small>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Update trending UI
     */
    updateTrendingUI(trending) {
        // Update trending genres
        const genresContainer = document.getElementById('trending-genres-list');
        if (genresContainer && trending.genres) {
            genresContainer.innerHTML = trending.genres.map((genre, index) => `
                <div class="trending-item">
                    <div class="d-flex align-items-center">
                        <span class="trending-rank">${index + 1}</span>
                        <span class="genre-name">${genre.name}</span>
                        <div class="ml-auto">
                            <small class="text-info">${genre.swaps} swaps</small>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        // Update trending books
        const booksContainer = document.getElementById('trending-books-list');
        if (booksContainer && trending.books) {
            booksContainer.innerHTML = trending.books.map((book, index) => `
                <div class="trending-book-item">
                    <div class="row align-items-center">
                        <div class="col-2">
                            <span class="trending-rank">${index + 1}</span>
                        </div>
                        <div class="col-3">
                            <img src="${book.image}" alt="${book.title}" class="img-fluid rounded" style="max-height: 60px;">
                        </div>
                        <div class="col-7">
                            <h6 class="mb-1 text-white">${book.title}</h6>
                            <p class="mb-0 text-muted small">by ${book.author}</p>
                            <small class="text-info">${book.swapCount} requests</small>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }
    
    /**
     * Animate number changes
     */
    animateNumber(element, start, end) {
        const duration = 1000; // 1 second
        const startTime = Date.now();
        
        // Store original classes to preserve gradient styling
        const originalClasses = element.className;
        
        const updateNumber = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + (end - start) * easeOut);
            
            // Use innerHTML to preserve classes and gradient styling
            element.innerHTML = current;
            
            // Restore original classes to maintain gradient
            if (originalClasses.includes('text-gradient')) {
                element.className = originalClasses;
            }
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            } else {
                // Animation complete - ensure gradient is properly applied
                if (originalClasses.includes('text-gradient')) {
                    element.className = originalClasses;
                }
            }
        };
        
        requestAnimationFrame(updateNumber);
    }
    
    /**
     * Cleanup when page is unloaded
     */
    destroy() {
        if (this.autoUpdateInterval) {
            clearInterval(this.autoUpdateInterval);
        }
    }
}

// Initialize dashboard updater when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/dashboard') {
        window.dashboardUpdater = new DashboardUpdater();
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (window.dashboardUpdater) {
                window.dashboardUpdater.destroy();
            }
        });
    }
});
