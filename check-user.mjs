import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

let uri = process.env.MONGODB_URI;

// Load MONGODB_URI from .env.local if not already in env
if (!uri) {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^MONGODB_URI\s*=\s*(.+)$/m);
      if (match) {
        uri = match[1].trim();
      }
    }
  } catch (err) {
    console.warn('Failed to read .env.local:', err.message);
  }
}

// Fallback to the Atlas URL
if (!uri) {
  uri = 'mongodb+srv://shubhamkpatil474_db_user:3AGpJ2VlYx46BZso@cluster0.yqal83g.mongodb.net/gittime?retryWrites=true&w=majority';
}

const targetEmail = process.argv[2] ? process.argv[2].trim().toLowerCase() : 'shubhamkpatil474@gmail.com';

await mongoose.connect(uri);
const user = await mongoose.connection.db.collection('users').findOne({ email: targetEmail });
console.log('User record:', JSON.stringify(user, null, 2));
await mongoose.disconnect();

