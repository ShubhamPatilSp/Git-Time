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
      case "subscription.charged": {
        // Recurring payment succeeded — extend subscription expiry
        const subscriptionId = payload?.subscription?.entity?.id;
        const notes = payload?.subscription?.entity?.notes || {};
        const email = notes.email;
        const planType = notes.planType || "monthly";

        if (email && subscriptionId) {
          const now = new Date();
          const expiry = new Date(now);
          if (planType === "yearly") {
            expiry.setFullYear(expiry.getFullYear() + 1);
          } else {
            expiry.setMonth(expiry.getMonth() + 1);
          }

          await User.findOneAndUpdate(
            { email },
            {
              isPro: true,
              plan: "pro",
              subscriptionExpiry: expiry,
              // Reset monthly runs on renewal
              runsThisMonth: 0,
              runsResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
            }
          );
          console.log(`[Webhook] subscription.charged — extended ${email} to ${expiry.toISOString()}`);
        }
        break;
      }

      case "subscription.cancelled": {
        // User cancelled — they keep access until current period ends
        const subscriptionId = payload?.subscription?.entity?.id;
        const notes = payload?.subscription?.entity?.notes || {};
        const email = notes.email;

        if (email) {
          // Don't immediately downgrade — the subscriptionExpiry field
          // will naturally handle access cutoff
          console.log(`[Webhook] subscription.cancelled — ${email} will expire at their current period end`);
        }
        break;
      }

      case "subscription.halted": {
        // Payment failed repeatedly — immediately downgrade
        const subscriptionId = payload?.subscription?.entity?.id;
        const notes = payload?.subscription?.entity?.notes || {};
        const email = notes.email;

        if (email) {
          await User.findOneAndUpdate(
            { email },
            {
              isPro: false,
              plan: "free",
              planType: "none",
              subscriptionId: null,
              subscriptionExpiry: null,
            }
          );
          console.log(`[Webhook] subscription.halted — downgraded ${email} to free`);
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
