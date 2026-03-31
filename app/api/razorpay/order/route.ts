import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { detectCountry, getTier } from "@/lib/geo";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "RAZORPAY_KEY_ID_MISSING",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "RAZORPAY_KEY_SECRET_MISSING",
});

// Map of tier + planType to Razorpay Plan IDs (set in environment variables)
function getPlanId(tier: string, planType: string): string {
  if (tier === 'tier1') {
    return planType === 'yearly'
      ? (process.env.RAZORPAY_PLAN_USD_ANNUAL || '')
      : (process.env.RAZORPAY_PLAN_USD_MONTHLY || '');
  }
  return planType === 'yearly'
    ? (process.env.RAZORPAY_PLAN_INR_ANNUAL || '')
    : (process.env.RAZORPAY_PLAN_INR_MONTHLY || '');
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const planType = body.planType || 'monthly'; // 'monthly' or 'yearly'

    // Detect geo tier
    const country = detectCountry(req.headers);
    const tier = getTier(country);
    const planId = getPlanId(tier, planType);

    if (!planId) {
      return NextResponse.json({ 
        error: "Subscription plan not configured. Please contact support." 
      }, { status: 500 });
    }

    // Create Razorpay subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: planType === 'yearly' ? 10 : 120, // max billing cycles
      notes: {
        email: session.user.email,
        tier,
        planType,
      },
    });

    // Save pricing tier on user for future reference
    await connectToDatabase();
    await User.findOneAndUpdate(
      { email: session.user.email },
      { pricingTier: tier }
    );

    return NextResponse.json({ 
      subscriptionId: subscription.id,
      tier,
      planType,
    });
  } catch (err) {
    console.error("Razorpay subscription error:", err);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}
