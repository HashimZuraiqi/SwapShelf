const BADGES = [
  {
    id: 'night-owl',
    name: 'The Owl',
    description: 'Visit the website between 10 PM and 6 AM',
    points: 50,
    category: 'time'
  },
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Visit the website between 5 AM and 8 AM',
    points: 30,
    category: 'time'
  },
  {
    id: 'daily-visitor',
    name: 'Daily Visitor',
    description: 'Visit the website 7 days in a row',
    points: 200,
    category: 'achievement'
  },
  {
    id: 'beta-tester',
    name: 'Beta Tester',
    description: 'Joined the beta program',
    points: 100,
    category: 'achievement'
  },
  {
    id: 'the-weekend',
    name: 'The Weekend',
    description: 'Logged in on a weekend (Friday or Saturday)',
    points: 25,
    category: 'time'
  },
  {
    id: 'the-collector',
    name: 'The Collector',
    description: 'Earned 3 different badges',
    points: 100,
    category: 'meta'
  }
];

module.exports = { BADGES };