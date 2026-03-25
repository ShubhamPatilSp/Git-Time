import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Initialize Razorpay
// Avoid throwing error right away if env vars are missing so the build doesn't crash on standard environments.
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "RAZORPAY_KEY_ID_MISSING",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "RAZORPAY_KEY_SECRET_MISSING",
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const options = {
      amount: 399 * 100, // ₹399 in paisa
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return NextResponse.json(order);
  } catch (err) {
    console.error("Razorpay order error:", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
