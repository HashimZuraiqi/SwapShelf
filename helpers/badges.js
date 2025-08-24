const User = require('../models/User');
const { BADGES } = require('./badgeDefinitions');

async function awardBadge(userId, badgeId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const alreadyHas = user.badges.some(b => b.id === badgeId);
  if (!alreadyHas) {
    const badge = BADGES.find(b => b.id === badgeId);
    if (!badge) throw new Error('Badge not defined');

    user.badges.push({ id: badge.id, name: badge.name, earnedAt: new Date() });

     user.points = (user.points || 0) + (badge.points || 0);

     if (badgeId !== 'the-collector') {
      user.collectorCounter = (user.collectorCounter || 0) + 1;
    }

    await user.save();
    console.log(`✅ Awarded ${badge.name} badge to ${user.email || user.fullname || user._id}`);

       if ((user.collectorCounter || 0) >= 3) {
      await awardBadge(userId, 'the-collector');
    }
  }
}




//night owl badge
async function awardNightOwlBadge(userId) {
  const currentHour = new Date().getHours();
  if (currentHour >= 22 || currentHour < 6) {
    await awardBadge(userId, 'night-owl');
  }
}

//early bird badge
async function awardEarlyBirdBadge(userId) {
  const currentHour = new Date().getHours();
  if (currentHour >= 5 && currentHour < 8) {
    await awardBadge(userId, 'early-bird');
  }
}

//daily visitor badge
async function awardDailyVisitorBadge(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const today = new Date();
  const todayStr = today.toDateString(); // e.g., "Sun Aug 24 2025"
  
  if (user.lastVisit === todayStr) {
    // Already visited today, nothing to do
    return;
  }

  // Check previous visit date
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  if (user.lastVisit === yesterdayStr) {
    // Consecutive visit
    user.consecutiveDays = (user.consecutiveDays || 0) + 1;
  } else {
    // Missed a day, reset streak
    user.consecutiveDays = 1;
  }

  user.lastVisit = todayStr;

  // Award badge if 7+ consecutive days
  if (user.consecutiveDays >= 7) {
    await awardBadge(userId, 'daily-visitor');
  }

  await user.save();
}
//beta tester
async function awardBetaTesterBadge(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  if (user.joinedBeta || user.betaJoinedAt) {
    await awardBadge(userId, 'beta-tester');
  }
}
//  The Weekend (Friday=5, Saturday=6) 
async function awardWeekendBadge(userId) {
  const day = new Date().getDay(); // Sun=0 ... Sat=6
  if (day === 5 || day === 6) {
    await awardBadge(userId, 'the-weekend');
  }
}
async function awardCollectorBadge(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const hasCollector = user.badges?.some(b => b.id === 'the-collector');
  if (hasCollector) return;

  // Count distinct badges excluding "the-collector" itself
  const distinct = new Set((user.badges || [])
    .filter(b => b && b.id !== 'the-collector')
    .map(b => b.id)
  );

  if (distinct.size >= 3) {
    await awardBadge(userId, 'the-collector');
  }
}

module.exports = {
  awardBadge,
  awardNightOwlBadge,
  awardEarlyBirdBadge,
  awardDailyVisitorBadge,
  awardBetaTesterBadge,
  awardWeekendBadge,
};