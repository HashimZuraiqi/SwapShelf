// Simple & Clean Navigation Active State Handler
document.addEventListener('DOMContentLoaded', function() {
    // Function to apply clean active styles matching index.html
    function applyActiveStyles(navLink) {
        if (navLink) {
            // Match the exact styling from index.html
            navLink.style.color = '#3BB7FB';
            navLink.style.background = 'rgba(59, 183, 251, 0.1)';
            navLink.style.borderRadius = '5px';
            navLink.style.fontWeight = '600';
            navLink.style.textDecoration = 'none';
            navLink.style.transition = 'all 0.3s ease';
        }
    }
    
    // Get current page from URL
    const currentPath = window.location.pathname;
    let currentPage = '';
    
    if (currentPath === '/' || currentPath === '/home') {
        currentPage = 'home';
    } else if (currentPath === '/dashboard') {
        currentPage = 'dashboard';
    } else if (currentPath === '/library') {
        currentPage = 'library';
    } else if (currentPath === '/wishlist') {
        currentPage = 'wishlist';
    } else if (currentPath === '/swap-matcher') {
        currentPage = 'swap-matcher';
    } else if (currentPath === '/nearby') {
        currentPage = 'nearby';
    } else if (currentPath === '/rewards') {
        currentPage = 'rewards';
    }
    
    // Clean reset for all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        const navLink = item.querySelector('.nav-link');
        if (navLink && !navLink.classList.contains('dropdown-toggle')) {
            // Reset to default styles
            navLink.style.background = '';
            navLink.style.color = '';
            navLink.style.fontWeight = '';
            navLink.style.borderRadius = '';
            navLink.style.padding = '';
        }
    });
    
    // Apply active styling to current page
    const activeNavItem = document.querySelector(`[data-page="${currentPage}"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
        const activeNavLink = activeNavItem.querySelector('.nav-link');
        applyActiveStyles(activeNavLink);
    }
});