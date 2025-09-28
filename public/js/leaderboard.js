// Leaderboard Page JavaScript

$(document).ready(function() {
    // Initialize leaderboard functionality
    initializePeriodSelector();
    initializeFilters();
    initializeLoadMore();
    animateElements();
    initializeMobileOptimizations();
});

// Mobile optimizations
function initializeMobileOptimizations() {
    // Improve touch interactions on mobile
    if (window.innerWidth <= 768) {
        // Add touch-friendly interactions
        $('.champion-card, .ranking-item').on('touchstart', function() {
            $(this).addClass('touch-active');
        }).on('touchend', function() {
            setTimeout(() => {
                $(this).removeClass('touch-active');
            }, 150);
        });
        
        // Optimize scroll performance
        let ticking = false;
        $(window).on('scroll', function() {
            if (!ticking) {
                requestAnimationFrame(updateScrollElements);
                ticking = true;
            }
        });
        
        function updateScrollElements() {
            ticking = false;
            // Add any scroll-based optimizations here
        }
    }
    
    // Handle orientation changes
    $(window).on('orientationchange resize', function() {
        setTimeout(function() {
            // Recalculate any dynamic sizing
            $('.podium-container').css('height', 'auto');
        }, 100);
    });
}

// Period Selector (Current Month, Previous Month, All Time)
function initializePeriodSelector() {
    $('.period-btn').click(function() {
        const period = $(this).data('period');
        
        // Update active state
        $('.period-btn').removeClass('active');
        $(this).addClass('active');
        
        // Load data for selected period
        loadLeaderboardData(period);
    });
}

// Filter System (All Users, Friends, Nearby)
function initializeFilters() {
    $('.filter-btn').click(function() {
        const filter = $(this).data('filter');
        
        // Update active state
        $('.filter-btn').removeClass('active');
        $(this).addClass('active');
        
        // Apply filter
        filterRankings(filter);
    });
}

// Load More Rankings
function initializeLoadMore() {
    $('#loadMoreRankings').click(function() {
        const button = $(this);
        const originalText = button.html();
        
        // Show loading state
        button.html('<i class="bi bi-arrow-clockwise spin"></i> Loading...')
              .prop('disabled', true);
        
        // Simulate API call
        setTimeout(function() {
            loadMoreRankings();
            
            // Update button or mark as complete
            if ($('.ranking-item').length >= 50) {
                button.html('<i class="bi bi-check-circle"></i> All Rankings Loaded')
                      .addClass('completed');
            } else {
                button.html(originalText).prop('disabled', false);
            }
        }, 1500);
    });
}

// Animate elements on page load
function animateElements() {
    // Animate champion cards
    $('.champion-card').each(function(index) {
        $(this).css({
            'opacity': '0',
            'transform': 'translateY(30px)'
        }).delay(index * 200).animate({
            'opacity': '1'
        }, 600).css('transform', 'translateY(0)');
    });
    
    // Animate ranking items
    $('.ranking-item').each(function(index) {
        $(this).css({
            'opacity': '0',
            'transform': 'translateX(-30px)'
        }).delay((index + 3) * 100).animate({
            'opacity': '1'
        }, 400).css('transform', 'translateX(0)');
    });
}

// Load leaderboard data for different periods
function loadLeaderboardData(period) {
    const leaderboardData = {
        current: {
            title: "September 2024 Rankings",
            champions: [
                { name: "BookMaster2024", points: 2850, badges: 14, swaps: 52, avatar: "/images/default-avatar.png" },
                { name: "ReadingQueen", points: 2420, badges: 12, swaps: 47, avatar: "/images/default-avatar.png" },
                { name: "SwapExpert", points: 2180, badges: 11, swaps: 43, avatar: "/images/default-avatar.png" }
            ]
        },
        previous: {
            title: "August 2024 Rankings",
            champions: [
                { name: "SwapExpert", points: 2650, badges: 10, swaps: 48, avatar: "/images/default-avatar.png" },
                { name: "BookMaster2024", points: 2420, badges: 13, swaps: 45, avatar: "/images/default-avatar.png" },
                { name: "NovelNinja", points: 2180, badges: 9, swaps: 41, avatar: "/images/default-avatar.png" }
            ]
        },
        "all-time": {
            title: "All-Time Legends",
            champions: [
                { name: "BookMaster2024", points: 15420, badges: 18, swaps: 312, avatar: "/images/default-avatar.png" },
                { name: "SwapExpert", points: 14180, badges: 17, swaps: 298, avatar: "/images/default-avatar.png" },
                { name: "ReadingQueen", points: 13950, badges: 16, swaps: 285, avatar: "/images/default-avatar.png" }
            ]
        }
    };
    
    // Show loading state
    showLoadingState();
    
    // Simulate API delay
    setTimeout(function() {
        updateChampions(leaderboardData[period].champions);
        updateRankingsList(period);
        hideLoadingState();
    }, 800);
}

// Filter rankings based on selection
function filterRankings(filter) {
    const rankingItems = $('.ranking-item');
    
    switch(filter) {
        case 'all':
            rankingItems.show();
            break;
        case 'friends':
            // In a real app, this would filter by friends
            rankingItems.hide();
            rankingItems.filter(':lt(5)').show();
            break;
        case 'nearby':
            // In a real app, this would filter by location
            rankingItems.hide();
            rankingItems.filter(':lt(3)').show();
            break;
    }
}

// Load more rankings
function loadMoreRankings() {
    const moreRankings = `
        <div class="ranking-item">
            <div class="rank-position">
                <span class="rank-number">11</span>
                <div class="rank-change positive">
                    <i class="bi bi-arrow-up"></i>
                    <span>+1</span>
                </div>
            </div>
            <div class="user-info">
                <img src="/images/default-avatar.png" alt="BookWorm2024" class="user-avatar">
                <div class="user-details">
                    <h4 class="username">BookWorm2024</h4>
                    <div class="user-stats">
                        <span class="badge-count">4 badges</span>
                        <span class="divider">•</span>
                        <span class="swap-count">15 swaps</span>
                        <span class="divider">•</span>
                        <span class="join-date">Joined Jun 2024</span>
                    </div>
                </div>
            </div>
            <div class="score-section">
                <span class="points">720</span>
                <span class="points-label">points</span>
            </div>
        </div>
        <div class="ranking-item">
            <div class="rank-position">
                <span class="rank-number">12</span>
                <div class="rank-change stable">
                    <i class="bi bi-dash"></i>
                    <span>0</span>
                </div>
            </div>
            <div class="user-info">
                <img src="/images/default-avatar.png" alt="NovelReader" class="user-avatar">
                <div class="user-details">
                    <h4 class="username">NovelReader</h4>
                    <div class="user-stats">
                        <span class="badge-count">3 badges</span>
                        <span class="divider">•</span>
                        <span class="swap-count">12 swaps</span>
                        <span class="divider">•</span>
                        <span class="join-date">Joined Jul 2024</span>
                    </div>
                </div>
            </div>
            <div class="score-section">
                <span class="points">650</span>
                <span class="points-label">points</span>
            </div>
        </div>
    `;
    
    $('.rankings-list').append(moreRankings);
    
    // Animate new items
    $('.ranking-item:last-child, .ranking-item:nth-last-child(2)').css({
        'opacity': '0',
        'transform': 'translateX(-30px)'
    }).animate({
        'opacity': '1'
    }, 400).css('transform', 'translateX(0)');
}

// Update champion podium
function updateChampions(champions) {
    champions.forEach((champion, index) => {
        const position = index === 0 ? '.first-place' : index === 1 ? '.second-place' : '.third-place';
        const card = $(position);
        
        card.find('.champion-name').text(champion.name);
        card.find('.avatar-image').attr('src', champion.avatar).attr('alt', champion.name);
        card.find('.stat-value').eq(0).text(champion.points.toLocaleString());
        card.find('.stat-value').eq(1).text(champion.badges);
        card.find('.stat-value').eq(2).text(champion.swaps);
    });
}

// Update rankings list
function updateRankingsList(period) {
    // This would typically fetch and update the full rankings list
    // For now, we'll just update the period indicator
    console.log(`Updated rankings for period: ${period}`);
}

// Show loading state
function showLoadingState() {
    $('.champions-podium').append(`
        <div class="loading-overlay">
            <i class="bi bi-arrow-clockwise spin" style="font-size: 2rem; color: #3BB7FB;"></i>
            <div class="mt-2" style="color: #b0b3b8;">Updating leaderboard...</div>
        </div>
    `);
    
    $('.loading-overlay').css({
        'position': 'absolute',
        'top': '50%',
        'left': '50%',
        'transform': 'translate(-50%, -50%)',
        'text-align': 'center',
        'background': 'rgba(13, 14, 16, 0.9)',
        'padding': '2rem',
        'border-radius': '16px',
        'z-index': '10'
    });
}

// Hide loading state
function hideLoadingState() {
    $('.loading-overlay').fadeOut(300, function() {
        $(this).remove();
    });
}

// Add spinning animation
$('<style>')
    .prop('type', 'text/css')
    .html(`
        .spin {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .completed {
            background: rgba(40, 167, 69, 0.2) !important;
            border-color: rgba(40, 167, 69, 0.3) !important;
            color: #28a745 !important;
        }
    `)
    .appendTo('head');