const mongoose = require('mongoose');
require('dotenv').config();

const fixConversations = async () => {
  try {
    console.log(' Fixing conversation collection...');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sirajbookweb');
    console.log('✅ Connected to MongoDB');

    const Conversation = require('../models/conversationModel');
    
  
    await mongoose.connection.dropCollection('conversations');
    console.log('✅ Dropped conversations collection');
    
 
    await Conversation.createCollection();
    console.log('✅ Recreated conversations collection');
    
    await mongoose.disconnect();
    console.log('✅ Fix completed successfully');
    
  } catch (error) {
    console.error('❌ Fix error:', error);

    if (error.message.includes('ns not found')) {
      console.log('✅ Collection already clean');
    } else {
      process.exit(1);
    }
  }
};


fixConversations();