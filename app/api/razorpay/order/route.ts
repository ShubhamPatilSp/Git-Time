import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { detectCountry, getTier, getPricing } from "@/lib/geo";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "RAZORPAY_KEY_ID_MISSING",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "RAZORPAY_KEY_SECRET_MISSING",
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // No body required for this endpoint
    const planType = 'monthly'; // We only offer monthly pricing now

    // Detect geo tier and get pricing
    const country = detectCountry(req.headers);
    const tier = getTier(country);
    const pricing = getPricing(tier);

    // Pick the right price based on billing cycle
    const priceInfo = pricing.monthly;

    // Create a Razorpay Order (one-time payment, no Plan IDs needed)
    const order = await razorpay.orders.create({
      amount: priceInfo.amount, // amount in smallest currency unit (paise / cents)
      currency: priceInfo.currency,
      receipt: `gt_${Date.now()}`,
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
      orderId: order.id,
      amount: priceInfo.amount,
      currency: priceInfo.currency,
      tier,
      planType,
    });
  } catch (err) {
    console.error("Razorpay order error:", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
