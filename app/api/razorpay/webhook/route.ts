import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";

// Razorpay sends webhook events as POST requests
// Docs: https://razorpay.com/docs/webhooks/

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    const eventType = event.event;
    const payload = event.payload;

    await connectToDatabase();

    switch (eventType) {
      case "order.paid": {
        // One-time payment succeeded — extend subscription expiry
        const orderId = payload?.order?.entity?.id;
        const notes = payload?.order?.entity?.notes || {};
        const email = notes.email;
        const planType = notes.planType || "monthly";

        if (email && orderId) {
          const now = new Date();
          const expiry = new Date(now);
          if (planType === "yearly") {
            expiry.setFullYear(expiry.getFullYear() + 1);
          } else {
            expiry.setMonth(expiry.getMonth() + 1);
          }

          // We check if the user is already pro with a future expiry and extend from there,
          // otherwise extend from now. Note: verify/route.ts usually handles this synchronously,
          // so we use findOneAndUpdate to ensure we don't accidentally shorten their expiry.
          const user = await User.findOne({ email });
          if (user) {
             const currentExpiry = user.subscriptionExpiry?.getTime() || 0;
             // Only update if the webhook order is newer/equivalent to what we already verified
             if (!user.subscriptionExpiry || currentExpiry < expiry.getTime() - 86400000) {
                await User.findOneAndUpdate(
                  { email },
                  {
                    isPro: true,
                    plan: "pro",
                    planType,
                    subscriptionExpiry: expiry,
                    runsThisMonth: 0,
                    runsResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
                  }
                );
                console.log(`[Webhook] order.paid — granted/extended ${email} to ${expiry.toISOString()}`);
             } else {
                console.log(`[Webhook] order.paid — ${email} already verified synchronously`);
             }
          }
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event: ${eventType}`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
