import { NextResponse } from "next/server";
import crypto from "crypto";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      planType // 'monthly' or 'yearly'
    } = await req.json();

    // Verify signature: order_id + "|" + payment_id
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "MISSING")
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      // Payment is authentic. Activate Pro!
      await connectToDatabase();

      // Calculate subscription expiry
      const now = new Date();
      const expiry = new Date(now);
      if (planType === 'yearly') {
        expiry.setFullYear(expiry.getFullYear() + 1);
      } else {
        expiry.setMonth(expiry.getMonth() + 1);
      }

      await User.findOneAndUpdate(
        { email: session.user.email },
        {
          isPro: true,
          plan: 'pro',
          planType: planType || 'monthly',
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          subscriptionExpiry: expiry,
          // Reset runs counter on upgrade
          runsThisMonth: 0,
          runsResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        }
      );

      return NextResponse.json({ success: true, message: "Pro activated successfully" });
    } else {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } catch (err) {
    console.error("Signature verification error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
