import mongoose from 'mongoose';

await mongoose.connect('mongodb+srv://shubhamkpatil474_db_user:3AGpJ2VlYx46BZso@cluster0.yqal83g.mongodb.net/gittime?retryWrites=true&w=majority');
const result = await mongoose.connection.db.collection('users').updateOne(
  { email: 'jojoxxjo92@gmail.com' },
  { $set: { isPro: true, plan: 'pro', planType: 'pro', pricingTier: 'pro' } }
);
console.log('Updated:', result.modifiedCount, 'Matched:', result.matchedCount);
await mongoose.disconnect();
