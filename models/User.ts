import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  isPro: boolean;
  freeCommitsUsed: number;
  razorpayOrderId?: string;
}

const UserSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true },
  isPro: { type: Boolean, default: false },
  freeRunsUsed: { type: Number, default: 0 },
  freeCommitsUsed: { type: Number, default: 0 },
  razorpayOrderId: { type: String },
});

// Avoid OverwriteModelError in Next.js HMR
export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
