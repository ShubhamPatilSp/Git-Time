import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  // Legacy field — kept for backward compat but plan/planType is the source of truth
  isPro: boolean;
  // Subscription
  plan: 'free' | 'pro';
  planType: 'none' | 'monthly' | 'yearly';
  subscriptionId?: string;
  subscriptionExpiry?: Date;
  pricingTier: 'tier1' | 'tier2';
  // Usage tracking (applies to ALL users, free and pro)
  runsThisMonth: number;
  runsResetAt: Date;
  freeCommitsUsed: number;
  freeRunsUsed: number;
  // Legacy
  razorpayOrderId?: string;
}

const UserSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true },
  isPro: { type: Boolean, default: false },
  // Subscription fields
  plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  planType: { type: String, enum: ['none', 'monthly', 'yearly'], default: 'none' },
  subscriptionId: { type: String },
  subscriptionExpiry: { type: Date },
  pricingTier: { type: String, enum: ['tier1', 'tier2'], default: 'tier2' },
  // Usage
  runsThisMonth: { type: Number, default: 0 },
  runsResetAt: { type: Date, default: () => new Date() },
  freeRunsUsed: { type: Number, default: 0 },
  freeCommitsUsed: { type: Number, default: 0 },
  // Legacy
  razorpayOrderId: { type: String },
});

// Helper: Check if user is actively subscribed
UserSchema.methods.isActivePro = function (): boolean {
  if (this.plan !== 'pro') return false;
  if (!this.subscriptionExpiry) return false;
  return new Date() < new Date(this.subscriptionExpiry);
};

// Helper: Get monthly run limit based on plan
UserSchema.methods.getMonthlyRunLimit = function (): number {
  return this.isActivePro() ? 30 : 3;
};

// Helper: Get per-generation commit limit based on plan
UserSchema.methods.getCommitLimit = function (): number {
  return this.isActivePro() ? 2000 : 100;
};

// Helper: Reset runs counter if we've crossed into a new month
UserSchema.methods.resetRunsIfNeeded = async function (): Promise<void> {
  const now = new Date();
  const resetAt = new Date(this.runsResetAt);
  if (now > resetAt) {
    // Set next reset to 1st of next month
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    this.runsThisMonth = 0;
    this.runsResetAt = nextReset;
    await this.save();
  }
};

// Avoid OverwriteModelError in Next.js HMR
export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
