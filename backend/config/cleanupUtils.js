const mongoose = require('mongoose');
const Conversation = require('../models/conversationModel');

const cleanupConversations = {
  
  removeDuplicates: async () => {
    try {
      console.log('Starting duplicate conversation cleanup...');
      
      const conversations = await Conversation.find({}).populate('participants');
      
      const seen = new Map();
      const duplicates = [];
      
      for (const conv of conversations) {
        if (conv.participants && conv.participants.length === 2) {
          const key = conv.participants
            .map(p => p._id.toString())
            .sort()
            .join('-');
          
          if (seen.has(key)) {
            duplicates.push(conv._id);
          } else {
            seen.set(key, conv._id);
          }
        } else {
          
          duplicates.push(conv._id);
        }
      }
      
      if (duplicates.length > 0) {
        await Conversation.deleteMany({ _id: { $in: duplicates } });
        console.log(`✅ Removed ${duplicates.length} duplicate conversations`);
        return { removed: duplicates.length, kept: seen.size };
      }
      
      console.log('✅ No duplicates found');
      return { removed: 0, kept: seen.size };
      
    } catch (error) {
      console.error('❌ Duplicate cleanup error:', error);
      throw error;
    }
  },

  
  fixParticipantCounts: async () => {
    try {
      console.log('🔧 Fixing participant counts...');
      
      const conversations = await Conversation.find({});
      const fixed = [];
      const deleted = [];
      
      for (const conv of conversations) {
        if (!conv.participants || conv.participants.length !== 2) {
          
          if (conv.participants && conv.participants.length > 2) {
            
            conv.participants = conv.participants.slice(0, 2);
            await conv.save();
            fixed.push(conv._id);
          } else {
           
            await Conversation.findByIdAndDelete(conv._id);
            deleted.push(conv._id);
          }
        }
      }
      
      console.log(`✅ Fixed ${fixed.length} conversations`);
      console.log(`✅ Deleted ${deleted.length} invalid conversations`);
      return { fixed, deleted };
      
    } catch (error) {
      console.error('❌ Participant count fix error:', error);
      throw error;
    }
  },

  fullCleanup: async () => {
    try {
      console.log('🚀 Starting full conversation cleanup...');
      
      const result1 = await cleanupConversations.fixParticipantCounts();
      const result2 = await cleanupConversations.removeDuplicates();
      
      console.log('✅ Full cleanup completed successfully');
      return { ...result1, ...result2 };
      
    } catch (error) {
      console.error('❌ Full cleanup error:', error);
      throw error;
    }
  }
};

module.exports = cleanupConversations;