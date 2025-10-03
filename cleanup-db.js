const mongoose = require('mongoose');
require('dotenv').config();

async function cleanupDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/SwapShelf');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Cleanup CHATROOMS collection
    console.log('📋 Existing indexes on chatrooms:');
    try {
      const indexes = await db.collection('chatrooms').indexes();
      console.log(indexes.map(idx => idx.name));
    } catch (e) {
      console.log('No chatrooms collection found or no indexes');
    }
    
    // Drop problematic roomId index if it exists
    try {
      await db.collection('chatrooms').dropIndex('roomId_1');
      console.log('🗑️  Dropped roomId_1 index from chatrooms');
    } catch (e) {
      console.log('ℹ️  roomId_1 index does not exist in chatrooms or already dropped');
    }
    
    // Remove any chatrooms with null roomId (if they exist)
    try {
      const result = await db.collection('chatrooms').deleteMany({ roomId: null });
      console.log('🧹 Removed', result.deletedCount, 'chatrooms with null roomId');
    } catch (e) {
      console.log('ℹ️  No problematic chatrooms to remove');
    }
    
    // Also remove any chatrooms with roomId field (which shouldn't exist)
    try {
      const result2 = await db.collection('chatrooms').deleteMany({ roomId: { $exists: true } });
      console.log('🧹 Removed', result2.deletedCount, 'chatrooms with roomId field');
    } catch (e) {
      console.log('ℹ️  No chatrooms with roomId field found');
    }
    
    // Cleanup MESSAGES collection
    console.log('📋 Existing indexes on messages:');
    try {
      const msgIndexes = await db.collection('messages').indexes();
      console.log(msgIndexes.map(idx => idx.name));
    } catch (e) {
      console.log('No messages collection found or no indexes');
    }
    
    // Drop problematic messageId index if it exists
    try {
      await db.collection('messages').dropIndex('messageId_1');
      console.log('🗑️  Dropped messageId_1 index from messages');
    } catch (e) {
      console.log('ℹ️  messageId_1 index does not exist in messages or already dropped');
    }
    
    // Remove any messages with null messageId (if they exist)
    try {
      const result3 = await db.collection('messages').deleteMany({ messageId: null });
      console.log('🧹 Removed', result3.deletedCount, 'messages with null messageId');
    } catch (e) {
      console.log('ℹ️  No problematic messages to remove');
    }
    
    // Also remove any messages with messageId field (which shouldn't exist)
    try {
      const result4 = await db.collection('messages').deleteMany({ messageId: { $exists: true } });
      console.log('🧹 Removed', result4.deletedCount, 'messages with messageId field');
    } catch (e) {
      console.log('ℹ️  No messages with messageId field found');
    }
    
    console.log('✅ Database cleanup complete');
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupDatabase();