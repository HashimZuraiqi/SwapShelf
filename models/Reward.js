const mongoose = require('mongoose');

// Badge definitions with their requirements
const BADGE_DEFINITIONS = {
  // Login & Visit Streaks
  'night_owl': {
    name: 'Night Owl',
    description: 'Visit the website between 10pm and 5am',
    icon: '🌙',
    category: 'login_visit',
    points: 25,
    requirement: { type: 'visit_time', condition: { start: 22, end: 5 } }
  },
  'early_bird': {
    name: 'Early Bird',
    description: 'Visit the website between 5am and 8am',
    icon: '☀️',
    category: 'login_visit',
    points: 25,
    requirement: { type: 'visit_time', condition: { start: 5, end: 8 } }
  },
  'daily_visitor': {
    name: 'Daily Visitor',
    description: 'Visit the website 7 days in a row',
    icon: '📅',
    category: 'login_visit',
    points: 50,
    requirement: { type: 'consecutive_days', condition: { days: 7 } }
  },
  'weekend_warrior': {
    name: 'The Weekend',
    description: 'Logged in on a weekend (Friday/Saturday)',
    icon: '🎉',
    category: 'login_visit',
    points: 30,
    requirement: { type: 'weekend_visit', condition: {} }
  },

  // Swapping Achievements
  'swap_rookie': {
    name: 'Swap Rookie',
    description: 'Made your first successful swap',
    icon: '📖',
    category: 'swapping',
    points: 100,
    requirement: { type: 'completed_swaps', condition: { count: 1 } }
  },
  'lucky_seven': {
    name: 'Lucky 7',
    description: 'Completed your 7th swap',
    icon: '🍀',
    category: 'swapping',
    points: 200,
    requirement: { type: 'completed_swaps', condition: { count: 7 } }
  },
  'swapaholic': {
    name: 'Swapaholic',
    description: 'Made 30 successful swaps',
    icon: '🔄',
    category: 'swapping',
    points: 500,
    requirement: { type: 'completed_swaps', condition: { count: 30 } }
  },
  'trade_master': {
    name: 'Trade Master',
    description: 'Completed 50 swaps',
    icon: '🏆',
    category: 'swapping',
    points: 750,
    requirement: { type: 'completed_swaps', condition: { count: 50 } }
  },
  'trade_champion': {
    name: 'Trade Champion',
    description: 'Reached 100 successful swaps',
    icon: '👑',
    category: 'swapping',
    points: 1000,
    requirement: { type: 'completed_swaps', condition: { count: 100 } }
  },
  'chill_trader': {
    name: 'Chill Trader',
    description: 'Completed a swap on weekend',
    icon: '🛋️',
    category: 'swapping',
    points: 75,
    requirement: { type: 'weekend_swap', condition: {} }
  },
  'the_wanderer': {
    name: 'The Wanderer',
    description: 'Made a swap with someone in another country',
    icon: '🌍',
    category: 'swapping',
    points: 150,
    requirement: { type: 'international_swap', condition: {} }
  },

  // Community & Meta
  'beta_tester': {
    name: 'Beta Tester',
    description: 'Joined the beta program',
    icon: '🧪',
    category: 'community',
    points: 100,
    requirement: { type: 'beta_member', condition: {} }
  },
  'community_helper': {
    name: 'Community Helper',
    description: 'Reported duplicate/inaccurate listings',
    icon: '🤝',
    category: 'community',
    points: 50,
    requirement: { type: 'reports_made', condition: { count: 1 } }
  },
  'the_collector': {
    name: 'The Collector',
    description: 'Earned 10 badges',
    icon: '📚',
    category: 'community',
    points: 300,
    requirement: { type: 'badges_earned', condition: { count: 10 } }
  },
  'all_star': {
    name: 'All-Star',
    description: 'Earned all available badges',
    icon: '⭐',
    category: 'community',
    points: 1000,
    requirement: { type: 'all_badges', condition: {} }
  },

  // Monthly Champions
  'monthly_champion': {
    name: 'Monthly Champion',
    description: 'Finished #1 in monthly leaderboard',
    icon: '🥇',
    category: 'monthly',
    points: 500,
    requirement: { type: 'monthly_rank', condition: { rank: 1 } }
  },
  'silver_medalist': {
    name: 'Silver Medalist',
    description: 'Finished #2 in monthly leaderboard',
    icon: '🥈',
    category: 'monthly',
    points: 300,
    requirement: { type: 'monthly_rank', condition: { rank: 2 } }
  },
  'bronze_winner': {
    name: 'Bronze Winner',
    description: 'Finished #3 in monthly leaderboard',
    icon: '🥉',
    category: 'monthly',
    points: 200,
    requirement: { type: 'monthly_rank', condition: { rank: 3 } }
  },
  'streak_master': {
    name: 'Streak Master',
    description: 'Top 5 for 3 consecutive months',
    icon: '🔥',
    category: 'monthly',
    points: 800,
    requirement: { type: 'consecutive_top5', condition: { months: 3 } }
  },
  'diamond_tier': {
    name: 'Diamond Tier',
    description: 'Won monthly champion 3 times',
    icon: '💎',
    category: 'monthly',
    points: 1500,
    requirement: { type: 'champion_wins', condition: { count: 3 } }
  },
  'rising_star': {
    name: 'Rising Star',
    description: 'Jumped 10+ ranks in one month',
    icon: '🌟',
    category: 'monthly',
    points: 200,
    requirement: { type: 'rank_jump', condition: { positions: 10 } }
  },

  // Special & Unique
  'genre_master': {
    name: 'Genre Master',
    description: 'Swapped books from 10 different genres',
    icon: '🎭',
    category: 'special',
    points: 300,
    requirement: { type: 'genre_diversity', condition: { count: 10 } }
  },
  'ancient_wisdom': {
    name: 'Ancient Wisdom',
    description: 'Swapped a book published before 1950',
    icon: '📜',
    category: 'special',
    points: 200,
    requirement: { type: 'vintage_book', condition: { year: 1950 } }
  },
  'speed_reader': {
    name: 'Speed Reader',
    description: 'Completed 5 swaps in 24 hours',
    icon: '🚀',
    category: 'special',
    points: 400,
    requirement: { type: 'swaps_in_day', condition: { count: 5, hours: 24 } }
  },
  'social_butterfly': {
    name: 'Social Butterfly',
    description: 'Swapped with 25 different users',
    icon: '🎪',
    category: 'special',
    points: 400,
    requirement: { type: 'unique_partners', condition: { count: 25 } }
  },
  'treasure_hunter': {
    name: 'Treasure Hunter',
    description: 'Found and swapped a rare/out-of-print book',
    icon: '🏴‍☠️',
    category: 'special',
    points: 300,
    requirement: { type: 'rare_book', condition: {} }
  },
  'art_enthusiast': {
    name: 'Art Enthusiast',
    description: 'Swapped 10 art or photography books',
    icon: '🎨',
    category: 'special',
    points: 250,
    requirement: { type: 'genre_books', condition: { genre: 'Art', count: 10 } }
  }
};

const rewardSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // Points and reputation
  totalPoints: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  reputationLevel: {
    type: String,
    enum: ['Newcomer', 'Explorer', 'Trader', 'Expert', 'Master', 'Legend'],
    default: 'Newcomer'
  },
  
  // Badge tracking
  badges: [{
    badgeId: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now },
    progress: { type: Number, default: 0 }, // For progress-based badges
    isUnlocked: { type: Boolean, default: false }
  }],
  
  // Activity tracking
  stats: {
    totalSwaps: { type: Number, default: 0 },
    completedSwaps: { type: Number, default: 0 },
    booksAdded: { type: Number, default: 0 },
    wishlistItems: { type: Number, default: 0 },
    reportsMade: { type: Number, default: 0 },
    consecutiveDays: { type: Number, default: 0 },
    lastVisitDate: { type: Date, default: Date.now },
    visitStreak: { type: Number, default: 0 },
    maxVisitStreak: { type: Number, default: 0 },
    uniquePartners: { type: Number, default: 0 },
    genresSwapped: { type: [String], default: [] },
    weekendSwaps: { type: Number, default: 0 },
    internationalSwaps: { type: Number, default: 0 },
    vintageBooks: { type: Number, default: 0 },
    rareBooks: { type: Number, default: 0 },
    artBooks: { type: Number, default: 0 }
  },
  
  // Monthly tracking
  monthlyStats: {
    currentMonth: { type: String, default: () => new Date().toISOString().slice(0, 7) },
    swapsThisMonth: { type: Number, default: 0 },
    pointsThisMonth: { type: Number, default: 0 },
    rankThisMonth: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 },
    rankHistory: [{
      month: String,
      rank: Number,
      points: Number
    }]
  },
  
  // Quest tracking
  activeQuests: [{
    questId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    reward: { type: Number, required: true },
    progress: { type: Number, default: 0 },
    target: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    isCompleted: { type: Boolean, default: false }
  }],
  
  // Achievement history
  achievementHistory: [{
    type: { type: String, required: true },
    description: { type: String, required: true },
    points: { type: Number, required: true },
    earnedAt: { type: Date, default: Date.now },
    meta: { type: Object, default: {} }
  }]
}, {
  timestamps: true
});

// Indexes for performance
rewardSchema.index({ user: 1, 'badges.badgeId': 1 });
rewardSchema.index({ 'monthlyStats.currentMonth': 1, 'monthlyStats.pointsThisMonth': -1 });
rewardSchema.index({ totalPoints: -1 });

// Virtual for unlocked badges count
rewardSchema.virtual('unlockedBadgesCount').get(function() {
  return this.badges.filter(badge => badge.isUnlocked).length;
});

// Virtual for total badges available
rewardSchema.virtual('totalBadgesAvailable').get(function() {
  return Object.keys(BADGE_DEFINITIONS).length;
});

// Method to calculate reputation level based on points
rewardSchema.methods.calculateReputationLevel = function() {
  const points = this.totalPoints;
  if (points >= 5000) return 'Legend';
  if (points >= 2500) return 'Master';
  if (points >= 1000) return 'Expert';
  if (points >= 500) return 'Trader';
  if (points >= 100) return 'Explorer';
  return 'Newcomer';
};

// Method to check if user can unlock a badge
rewardSchema.methods.canUnlockBadge = function(badgeId) {
  const badge = BADGE_DEFINITIONS[badgeId];
  if (!badge) return false;
  
  const userBadge = this.badges.find(b => b.badgeId === badgeId);
  if (userBadge && userBadge.isUnlocked) return false;
  
  // Check requirements based on badge type
  switch (badge.requirement.type) {
    case 'completed_swaps':
      return this.stats.completedSwaps >= badge.requirement.condition.count;
    case 'consecutive_days':
      return this.stats.consecutiveDays >= badge.requirement.condition.days;
    case 'visit_time':
      const now = new Date();
      const currentHour = now.getHours();
      const { start, end } = badge.requirement.condition;
      
      // Handle overnight time ranges (e.g., 10pm to 5am)
      if (start > end) {
        return currentHour >= start || currentHour < end;
      } else {
        return currentHour >= start && currentHour < end;
      }
    case 'weekend_visit':
      return this.stats.visitStreak > 0; // Simplified check
    case 'reports_made':
      return this.stats.reportsMade >= badge.requirement.condition.count;
    case 'badges_earned':
      return this.unlockedBadgesCount >= badge.requirement.condition.count;
    case 'genre_diversity':
      return this.stats.genresSwapped.length >= badge.requirement.condition.count;
    case 'unique_partners':
      return this.stats.uniquePartners >= badge.requirement.condition.count;
    case 'weekend_swap':
      return this.stats.weekendSwaps > 0;
    case 'international_swap':
      return this.stats.internationalSwaps > 0;
    case 'vintage_book':
      return this.stats.vintageBooks > 0;
    case 'rare_book':
      return this.stats.rareBooks > 0;
    case 'genre_books':
      return this.stats.artBooks >= badge.requirement.condition.count;
    default:
      return false;
  }
};

// Method to unlock a badge
rewardSchema.methods.unlockBadge = function(badgeId) {
  const badge = BADGE_DEFINITIONS[badgeId];
  if (!badge) return false;
  
  if (!this.canUnlockBadge(badgeId)) return false;
  
  // Add or update badge
  const existingBadge = this.badges.find(b => b.badgeId === badgeId);
  if (existingBadge) {
    // Badge already exists - only update if not already unlocked
    if (!existingBadge.isUnlocked) {
      existingBadge.isUnlocked = true;
      existingBadge.unlockedAt = new Date();
      // Add points only if badge was not previously unlocked
      this.totalPoints += badge.points;
    }
    // If already unlocked, do nothing (prevent duplicate points)
  } else {
    // New badge - add it and award points
    this.badges.push({
      badgeId,
      isUnlocked: true,
      unlockedAt: new Date()
    });
    this.totalPoints += badge.points;
  }
  
  // Update reputation level
  this.reputationLevel = this.calculateReputationLevel();
  
  // Add to achievement history
  this.achievementHistory.push({
    type: 'badge_unlocked',
    description: `Unlocked badge: ${badge.name}`,
    points: badge.points,
    meta: { badgeId, badgeName: badge.name }
  });
  
  return true;
};

// Method to add points
rewardSchema.methods.addPoints = function(points, reason, meta = {}) {
  this.totalPoints += points;
  this.reputationLevel = this.calculateReputationLevel();
  
  this.achievementHistory.push({
    type: 'points_earned',
    description: reason,
    points,
    meta
  });
  
  return this.save();
};

// Method to get badge progress
rewardSchema.methods.getBadgeProgress = function(badgeId) {
  const badge = BADGE_DEFINITIONS[badgeId];
  if (!badge) return { progress: 0, target: 0, percentage: 0 };
  
  const userBadge = this.badges.find(b => b.badgeId === badgeId);
  if (userBadge && userBadge.isUnlocked) {
    return { progress: 1, target: 1, percentage: 100 };
  }
  
  let current = 0;
  let target = 1;
  
  switch (badge.requirement.type) {
    case 'completed_swaps':
      current = this.stats.completedSwaps;
      target = badge.requirement.condition.count;
      break;
    case 'consecutive_days':
      current = this.stats.consecutiveDays;
      target = badge.requirement.condition.days;
      break;
    case 'reports_made':
      current = this.stats.reportsMade;
      target = badge.requirement.condition.count;
      break;
    case 'badges_earned':
      current = this.unlockedBadgesCount;
      target = badge.requirement.condition.count;
      break;
    case 'genre_diversity':
      current = this.stats.genresSwapped.length;
      target = badge.requirement.condition.count;
      break;
    case 'unique_partners':
      current = this.stats.uniquePartners;
      target = badge.requirement.condition.count;
      break;
    case 'genre_books':
      current = this.stats.artBooks;
      target = badge.requirement.condition.count;
      break;
    default:
      return { progress: 0, target: 1, percentage: 0 };
  }
  
  const percentage = Math.min(Math.round((current / target) * 100), 100);
  return { progress: current, target, percentage };
};

// Static method to get badge definitions
rewardSchema.statics.getBadgeDefinitions = function() {
  return BADGE_DEFINITIONS;
};

// Static method to create or get user rewards
rewardSchema.statics.getOrCreateUserRewards = async function(userId) {
  let rewards = await this.findOne({ user: userId });
  
  if (!rewards) {
    rewards = new this({
      user: userId,
      totalPoints: 0,
      reputationLevel: 'Newcomer',
      badges: [],
      stats: {
        totalSwaps: 0,
        completedSwaps: 0,
        booksAdded: 0,
        wishlistItems: 0,
        reportsMade: 0,
        consecutiveDays: 0,
        lastVisitDate: new Date(),
        visitStreak: 0,
        maxVisitStreak: 0,
        uniquePartners: 0,
        genresSwapped: [],
        weekendSwaps: 0,
        internationalSwaps: 0,
        vintageBooks: 0,
        rareBooks: 0,
        artBooks: 0
      },
      monthlyStats: {
        currentMonth: new Date().toISOString().slice(0, 7),
        swapsThisMonth: 0,
        pointsThisMonth: 0,
        rankThisMonth: 0,
        previousRank: 0,
        rankHistory: []
      },
      activeQuests: [],
      achievementHistory: []
    });
    
    await rewards.save();
  }
  
  return rewards;
};

module.exports = mongoose.model('Reward', rewardSchema);
