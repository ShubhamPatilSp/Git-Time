import mongoose from 'mongoose';

await mongoose.connect('mongodb+srv://shubhamkpatil474_db_user:3AGpJ2VlYx46BZso@cluster0.yqal83g.mongodb.net/gittime?retryWrites=true&w=majority');
const user = await mongoose.connection.db.collection('users').findOne({ email: 'shubhamkpatil474@gmail.com' });
console.log('User record:', JSON.stringify(user, null, 2));
await mongoose.disconnect();
