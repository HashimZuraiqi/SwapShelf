// Mobile Navigation Toggle Handler - Ultra Robust Version
let initAttempts = 0;
const MAX_ATTEMPTS = 10;

function initMobileNav() {
    initAttempts++;
    console.log(`🔧 Mobile nav script initializing... (Attempt ${initAttempts}/${MAX_ATTEMPTS})`);
    
    const navbarToggler = document.querySelector('.navbar-toggler');
    const navbarCollapse = document.getElementById('navbarNav');
    
    if (!navbarToggler || !navbarCollapse) {
        console.warn(`⚠️ Navbar elements not found yet (Attempt ${initAttempts})`);
        console.log('Toggler found:', !!navbarToggler, 'Collapse found:', !!navbarCollapse);
        
        if (initAttempts < MAX_ATTEMPTS) {
            setTimeout(initMobileNav, 100); // Retry after 100ms
            return false;
        } else {
            console.error('❌ Failed to initialize mobile nav after', MAX_ATTEMPTS, 'attempts');
            return false;
        }
    }
    
    console.log('✅ Navbar toggler and collapse found');
    console.log('Toggler element:', navbarToggler);
    console.log('Collapse element:', navbarCollapse);
    
    // Let Bootstrap handle the toggle naturally via data-toggle attribute
    // We just need to ensure it doesn't conflict
    console.log('✅ Using Bootstrap native collapse behavior');
    
    // Close menu when clicking on a nav link (mobile) - but NOT dropdown toggle
    const navLinks = document.querySelectorAll('#navbarNav .nav-link:not(.dropdown-toggle)');
    console.log(`📱 Found ${navLinks.length} nav links`);
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if (window.innerWidth < 992) {
                setTimeout(() => {
                    const collapse = document.getElementById('navbarNav');
                    if (collapse && collapse.classList.contains('show')) {
                        collapse.classList.remove('show');
                        const toggler = document.querySelector('.navbar-toggler');
                        if (toggler) {
                            toggler.setAttribute('aria-expanded', 'false');
                        }
                        console.log('📱 Menu closed after link click');
                    }
                }, 200);
            }
        });
    });
    
    // Handle Profile Dropdown
    const profileDropdowns = document.querySelectorAll('.dropdown-toggle');
    console.log(`👤 Found ${profileDropdowns.length} dropdown toggles`);
    
    profileDropdowns.forEach(dropdown => {
        dropdown.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('👤 Profile dropdown clicked');
            
            const parentLi = this.closest('.dropdown');
            const dropdownMenu = parentLi.querySelector('.dropdown-menu');
            
            if (dropdownMenu) {
                document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                    if (menu !== dropdownMenu) {
                        menu.classList.remove('show');
                    }
                });
                
                dropdownMenu.classList.toggle('show');
                this.setAttribute('aria-expanded', dropdownMenu.classList.contains('show'));
                console.log('📋 Dropdown toggled:', dropdownMenu.classList.contains('show'));
            }
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.navbar')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
                const toggle = menu.closest('.dropdown').querySelector('.dropdown-toggle');
                if (toggle) {
                    toggle.setAttribute('aria-expanded', 'false');
                }
            });
        }
        
        if (e.target.closest('.navbar') && !e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
                const toggle = menu.closest('.dropdown').querySelector('.dropdown-toggle');
                if (toggle) {
                    toggle.setAttribute('aria-expanded', 'false');
                }
            });
        }
    });
    
    console.log('✅ Mobile nav initialized successfully');
    return true;
}

// Try multiple initialization strategies
console.log('📱 Mobile nav script loaded, readyState:', document.readyState);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
} else {
    initMobileNav();
}

// Also try on window load as a backup
window.addEventListener('load', function() {
    console.log('🔄 Window loaded, checking mobile nav...');
    if (initAttempts === 0 || !document.querySelector('.navbar-toggler')) {
        initMobileNav();
    }
});
