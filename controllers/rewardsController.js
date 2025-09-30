const Reward = require('../models/Reward');
const User = require('../models/User');
const Book = require('../models/Book');
const Swap = require('../models/Swap');
const Activity = require('../models/Activity');

/**
 * Rewards Controller
 * Handles all rewards and achievements functionality
 */

class RewardsController {
  
  /**
   * Debug endpoint to check user's actual badges
   */
  static async debugUserBadges(req, res) {
    try {
      const userId = req.session?.user?._id || req.session?.user?.id;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      const rewards = await Reward.getOrCreateUserRewards(userId);
      
      return res.json({
        success: true,
        data: {
          totalBadges: rewards.badges.length,
          unlockedBadges: rewards.badges.filter(b => b.isUnlocked).length,
          badges: rewards.badges.map(b => ({
            badgeId: b.badgeId,
            isUnlocked: b.isUnlocked,
            unlockedAt: b.unlockedAt
          })),
          unlockedBadgesCount: rewards.unlockedBadgesCount
        }
      });
    } catch (error) {
      console.error('Debug badges error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error debugging badges' 
      });
    }
  }

  /**
   * Get user's complete rewards data
   */
  static async getUserRewards(req, res) {
    try {
      const userId = req.session?.user?._id || req.session?.user?.id;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      // Get or create user rewards
      const rewards = await Reward.getOrCreateUserRewards(userId);
      
      // Record visit activity for time-based badges
      try {
        await RewardsController.recordActivity(userId, 'visit');
      } catch (visitError) {
        console.error('Error recording visit activity:', visitError.message);
        // Continue without recording visit
      }
      
      // Update user stats from recent activities
      try {
        await RewardsController.updateUserStats(userId, rewards);
      } catch (statsError) {
        console.error('Error updating user stats:', statsError.message);
        // Continue without updating stats
      }
      
      // Check for new badge unlocks
      try {
        await RewardsController.checkAndUnlockBadges(rewards);
      } catch (badgeError) {
        console.error('Error checking badges:', badgeError.message);
        // Continue without checking badges
      }
      
      // Debug: Log actual badges for troubleshooting
      console.log('User badges:', rewards.badges);
      console.log('Unlocked badges count:', rewards.unlockedBadgesCount);
      
      // Validate and fix badge count if needed
      const actualUnlockedCount = rewards.badges.filter(b => b.isUnlocked === true).length;
      const virtualCount = rewards.unlockedBadgesCount;
      
      console.log(`🔍 Badge count check - Virtual: ${virtualCount}, Actual: ${actualUnlockedCount}`);
      
      if (actualUnlockedCount !== virtualCount || actualUnlockedCount > 2) {
        console.log(`⚠️  Badge count issue detected! Virtual: ${virtualCount}, Actual: ${actualUnlockedCount}`);
        
        // Clean up duplicate badges
        const uniqueBadges = [];
        const seenBadgeIds = new Set();
        
        rewards.badges.forEach(badge => {
          if (!seenBadgeIds.has(badge.badgeId)) {
            seenBadgeIds.add(badge.badgeId);
            uniqueBadges.push(badge);
          } else {
            console.log(`🗑️  Removing duplicate: ${badge.badgeId}`);
          }
        });
        
        // If still more than 2, keep only the first 2 unlocked badges
        if (uniqueBadges.filter(b => b.isUnlocked).length > 2) {
          console.log(`🔧 Limiting to 2 unlocked badges`);
          const unlockedBadges = uniqueBadges.filter(b => b.isUnlocked).slice(0, 2);
          const lockedBadges = uniqueBadges.filter(b => !b.isUnlocked);
          rewards.badges = [...unlockedBadges, ...lockedBadges];
        } else {
          rewards.badges = uniqueBadges;
        }
        
        // Special case: If user has multiple Night Owl badges, keep only one
        const nightOwlBadges = rewards.badges.filter(b => b.badgeId === 'night_owl');
        if (nightOwlBadges.length > 1) {
          console.log(`🌙 Found ${nightOwlBadges.length} Night Owl badges, keeping only one`);
          const otherBadges = rewards.badges.filter(b => b.badgeId !== 'night_owl');
          const firstNightOwl = nightOwlBadges[0];
          rewards.badges = [...otherBadges, firstNightOwl];
        }
        
        // Recalculate total points to ensure accuracy
        const badgeDefinitions = Reward.getBadgeDefinitions();
        let correctPoints = 0;
        rewards.badges.forEach(badge => {
          if (badge.isUnlocked && badgeDefinitions[badge.badgeId]) {
            correctPoints += badgeDefinitions[badge.badgeId].points;
          }
        });
        
        if (correctPoints !== rewards.totalPoints) {
          console.log(`💰 Points correction: ${rewards.totalPoints} → ${correctPoints}`);
          rewards.totalPoints = correctPoints;
        }
        
        rewards.markModified('badges');
        
        // Save the changes
        try {
          await rewards.save();
          console.log(`✅ Badge cleanup completed and saved!`);
        } catch (saveError) {
          console.error(`❌ Error saving badge cleanup:`, saveError.message);
        }
      }
      
      // Get badge definitions for frontend
      const badgeDefinitions = Reward.getBadgeDefinitions();
      
      // Calculate progress for all badges
      const badgesWithProgress = Object.keys(badgeDefinitions).map(badgeId => {
        const definition = badgeDefinitions[badgeId];
        const progress = rewards.getBadgeProgress(badgeId);
        const userBadge = rewards.badges.find(b => b.badgeId === badgeId);
        
        return {
          id: badgeId,
          ...definition,
          isUnlocked: userBadge ? userBadge.isUnlocked : false,
          unlockedAt: userBadge ? userBadge.unlockedAt : null,
          progress: progress.progress,
          target: progress.target,
          percentage: progress.percentage
        };
      });

      // Get active quests
      let activeQuests = [];
      try {
        activeQuests = await RewardsController.generateActiveQuests(userId, rewards);
      } catch (questError) {
        console.error('Error generating quests:', questError.message);
        activeQuests = [];
      }
      
      // Get recent achievements
      const recentAchievements = rewards.achievementHistory
        .sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt))
        .slice(0, 10);

      // Calculate next milestone
      const nextMilestone = RewardsController.getNextMilestone(rewards);

      res.json({
        success: true,
        data: {
          user: {
            totalPoints: rewards.totalPoints,
            reputationLevel: rewards.reputationLevel,
            unlockedBadges: actualUnlockedCount, // Use manually calculated count
            totalBadges: rewards.totalBadgesAvailable
          },
          stats: rewards.stats,
          badges: badgesWithProgress,
          activeQuests,
          recentAchievements,
          nextMilestone,
          monthlyStats: rewards.monthlyStats
        }
      });

    } catch (error) {
      console.error('Error fetching user rewards:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch rewards data',
        error: error.message
      });
    }
  }

  /**
   * Get leaderboard data
   */
  static async getLeaderboard(req, res) {
    try {
      const { period = 'monthly', limit = 50 } = req.query;
      
      let sortCriteria = {};
      let matchCriteria = {};
      
      if (period === 'monthly') {
        const currentMonth = new Date().toISOString().slice(0, 7);
        sortCriteria = { 'monthlyStats.pointsThisMonth': -1 };
        matchCriteria = { 'monthlyStats.currentMonth': currentMonth };
      } else {
        sortCriteria = { totalPoints: -1 };
      }

      const leaderboard = await Reward.find(matchCriteria)
        .populate('user', 'username fullname photo')
        .sort(sortCriteria)
        .limit(parseInt(limit))
        .lean();

      // Get current user's rank
      const userId = req.session?.user?._id || req.session?.user?.id;
      let userRank = null;
      
      if (userId) {
        const userReward = await Reward.findOne({ user: userId });
        if (userReward) {
          if (period === 'monthly') {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const userMonthStats = userReward.monthlyStats.rankHistory.find(
              stat => stat.month === currentMonth
            );
            userRank = userMonthStats ? userMonthStats.rank : null;
          } else {
            const rankCount = await Reward.countDocuments({ 
              totalPoints: { $gt: userReward.totalPoints } 
            });
            userRank = rankCount + 1;
          }
        }
      }

      res.json({
        success: true,
        data: {
          leaderboard: leaderboard.map((reward, index) => ({
            rank: index + 1,
            user: reward.user,
            points: period === 'monthly' ? reward.monthlyStats.pointsThisMonth : reward.totalPoints,
            badges: reward.unlockedBadgesCount,
            reputationLevel: reward.reputationLevel
          })),
          userRank,
          period
        }
      });

    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch leaderboard',
        error: error.message
      });
    }
  }

  /**
   * Claim quest reward
   */
  static async claimQuestReward(req, res) {
    try {
      const userId = req.session?.user?._id || req.session?.user?.id;
      const { questId } = req.body;
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      const rewards = await Reward.getOrCreateUserRewards(userId);
      const quest = rewards.activeQuests.find(q => q.questId === questId);
      
      if (!quest) {
        return res.status(404).json({
          success: false,
          message: 'Quest not found'
        });
      }

      if (!quest.isCompleted) {
        return res.status(400).json({
          success: false,
          message: 'Quest not completed yet'
        });
      }

      // Add points
      await rewards.addPoints(quest.reward, `Completed quest: ${quest.title}`);
      
      // Remove quest from active quests
      rewards.activeQuests = rewards.activeQuests.filter(q => q.questId !== questId);
      await rewards.save();

      res.json({
        success: true,
        message: 'Quest reward claimed successfully',
        data: {
          pointsEarned: quest.reward,
          newTotalPoints: rewards.totalPoints
        }
      });

    } catch (error) {
      console.error('Error claiming quest reward:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to claim quest reward',
        error: error.message
      });
    }
  }

  /**
   * Update user statistics based on recent activities
   */
  static async updateUserStats(userId, rewards) {
    try {
      // Get user's books
      const userBooks = await Book.find({ owner: userId });
      rewards.stats.booksAdded = userBooks.length;

      // Get user's swaps
      const userSwaps = await Swap.find({
        $or: [{ requester: userId }, { owner: userId }]
      });

      console.log(`📊 Found ${userSwaps.length} total swaps for user`);
      userSwaps.forEach(swap => console.log(`   Swap status: ${swap.status}`));

      rewards.stats.totalSwaps = userSwaps.length;
      rewards.stats.completedSwaps = userSwaps.filter(swap => swap.status === 'Completed').length;
      
      console.log(`✅ Completed swaps: ${rewards.stats.completedSwaps}`);

      // Get unique partners
      const uniquePartners = new Set();
      userSwaps.forEach(swap => {
        if (swap.requester.toString() !== userId.toString()) {
          uniquePartners.add(swap.requester.toString());
        }
        if (swap.owner.toString() !== userId.toString()) {
          uniquePartners.add(swap.owner.toString());
        }
      });
      rewards.stats.uniquePartners = uniquePartners.size;

      // Get genres swapped
      const genresSwapped = new Set();
      userSwaps.forEach(swap => {
        if (swap.bookRequested && swap.bookRequested.genre) {
          genresSwapped.add(swap.bookRequested.genre);
        }
        if (swap.bookOffered && swap.bookOffered.genre) {
          genresSwapped.add(swap.bookOffered.genre);
        }
      });
      rewards.stats.genresSwapped = Array.from(genresSwapped);

      // Count weekend swaps
      rewards.stats.weekendSwaps = userSwaps.filter(swap => {
        const swapDate = new Date(swap.createdAt);
        const dayOfWeek = swapDate.getDay();
        return dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday
      }).length;

      // Count art books
      rewards.stats.artBooks = userBooks.filter(book => 
        book.genre && typeof book.genre === 'string' && book.genre.toLowerCase().includes('art')
      ).length;

      // Update visit streak
      const today = new Date();
      const lastVisit = new Date(rewards.stats.lastVisitDate);
      const daysDiff = Math.floor((today - lastVisit) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        rewards.stats.consecutiveDays += 1;
        rewards.stats.visitStreak += 1;
      } else if (daysDiff > 1) {
        rewards.stats.consecutiveDays = 1;
        rewards.stats.visitStreak = 1;
      }
      
      rewards.stats.maxVisitStreak = Math.max(rewards.stats.maxVisitStreak, rewards.stats.visitStreak);
      rewards.stats.lastVisitDate = today;

      // Update monthly stats
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (rewards.monthlyStats.currentMonth !== currentMonth) {
        // Save previous month's rank
        rewards.monthlyStats.rankHistory.push({
          month: rewards.monthlyStats.currentMonth,
          rank: rewards.monthlyStats.rankThisMonth,
          points: rewards.monthlyStats.pointsThisMonth
        });
        
        // Reset for new month
        rewards.monthlyStats.currentMonth = currentMonth;
        rewards.monthlyStats.swapsThisMonth = 0;
        rewards.monthlyStats.pointsThisMonth = 0;
        rewards.monthlyStats.previousRank = rewards.monthlyStats.rankThisMonth;
        rewards.monthlyStats.rankThisMonth = 0;
      }

      await rewards.save();
      
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }

  /**
   * Check and unlock new badges
   */
  static async checkAndUnlockBadges(rewards) {
    try {
      const badgeDefinitions = Reward.getBadgeDefinitions();
      let newBadgesUnlocked = [];

      for (const badgeId of Object.keys(badgeDefinitions)) {
        if (rewards.canUnlockBadge(badgeId)) {
          const unlocked = rewards.unlockBadge(badgeId);
          if (unlocked) {
            newBadgesUnlocked.push(badgeId);
          }
        }
      }

      if (newBadgesUnlocked.length > 0) {
        await rewards.save();
        
        // Log activity for new badges
        for (const badgeId of newBadgesUnlocked) {
          const badge = badgeDefinitions[badgeId];
          await Activity.create({
            user: rewards.user,
            action: 'EARN_POINTS',
            message: `Unlocked new badge: ${badge.name}`,
            meta: { 
              badgeId, 
              badgeName: badge.name, 
              points: badge.points,
              type: 'badge_unlock'
            }
          });
        }
      }

      return newBadgesUnlocked;
      
    } catch (error) {
      console.error('Error checking badges:', error);
      return [];
    }
  }

  /**
   * Generate active quests for user
   */
  static async generateActiveQuests(userId, rewards) {
    const quests = [];
    const currentDate = new Date();

    // Weekly Swapper quest
    const weeklySwaps = rewards.monthlyStats.swapsThisMonth;
    if (weeklySwaps < 3) {
      quests.push({
        questId: 'weekly_swapper',
        title: 'Weekly Swapper',
        description: 'Complete 3 swaps this week',
        reward: 75,
        progress: weeklySwaps,
        target: 3,
        expiresAt: new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        isCompleted: weeklySwaps >= 3
      });
    }

    // Consistent Visitor quest
    if (rewards.stats.consecutiveDays < 5) {
      quests.push({
        questId: 'consistent_visitor',
        title: 'Consistent Visitor',
        description: 'Visit the site 5 days in a row',
        reward: 50,
        progress: rewards.stats.consecutiveDays,
        target: 5,
        expiresAt: new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        isCompleted: rewards.stats.consecutiveDays >= 5
      });
    }

    // Community Guardian quest
    if (rewards.stats.reportsMade < 2) {
      quests.push({
        questId: 'community_guardian',
        title: 'Community Guardian',
        description: 'Report 2 inaccurate book listings',
        reward: 100,
        progress: rewards.stats.reportsMade,
        target: 2,
        expiresAt: new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000),
        isCompleted: rewards.stats.reportsMade >= 2
      });
    }

    // Library Builder quest
    if (rewards.stats.booksAdded < 5) {
      quests.push({
        questId: 'library_builder',
        title: 'Library Builder',
        description: 'Add 5 books to your library',
        reward: 25,
        progress: rewards.stats.booksAdded,
        target: 5,
        expiresAt: new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        isCompleted: rewards.stats.booksAdded >= 5
      });
    }

    return quests;
  }

  /**
   * Get next milestone for user
   */
  static getNextMilestone(rewards) {
    const milestones = [
      { points: 100, name: 'Explorer', description: 'Reach 100 points' },
      { points: 500, name: 'Trader', description: 'Reach 500 points' },
      { points: 1000, name: 'Expert', description: 'Reach 1,000 points' },
      { points: 2500, name: 'Master', description: 'Reach 2,500 points' },
      { points: 5000, name: 'Legend', description: 'Reach 5,000 points' }
    ];

    const currentPoints = rewards.totalPoints;
    const nextMilestone = milestones.find(m => m.points > currentPoints);
    
    if (nextMilestone) {
      return {
        ...nextMilestone,
        progress: currentPoints,
        percentage: Math.round((currentPoints / nextMilestone.points) * 100)
      };
    }

    return null;
  }

  /**
   * Record user activity for rewards
   */
  static async recordActivity(userId, activityType, meta = {}) {
    try {
      const rewards = await Reward.getOrCreateUserRewards(userId);
      
      switch (activityType) {
        case 'book_added':
          rewards.stats.booksAdded += 1;
          await rewards.addPoints(10, 'Added a book to library', meta);
          break;
          
        case 'swap_completed':
          rewards.stats.completedSwaps += 1;
          rewards.monthlyStats.swapsThisMonth += 1;
          await rewards.addPoints(50, 'Completed a swap', meta);
          break;
          
        case 'report_made':
          rewards.stats.reportsMade += 1;
          await rewards.addPoints(25, 'Reported an issue', meta);
          break;
          
        case 'visit':
          // Visit tracking is handled in updateUserStats
          break;
      }

      await rewards.save();
      
      // Check for new badge unlocks
      await RewardsController.checkAndUnlockBadges(rewards);
      
    } catch (error) {
      console.error('Error recording activity:', error);
    }
  }
}

module.exports = RewardsController;
