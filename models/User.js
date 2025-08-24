const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullname: String,
  email: String,
  password: String,
  location: String,
  //badge fields
 badges: [{ id: String, name: String, earnedAt: Date }],
 lastVisit: String,
 consecutiveDays: Number,
 joinedBeta: { type: Boolean, default: false },
 betaJoinedAt: { type: Date, default: null },
 collectorCounter: { type: Number, default: 0 },
 points: { type: Number, default: 0 } 
});

module.exports = mongoose.model('User', userSchema);
