import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import connectToDatabase from "./db";
import User from "../models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user?.email) {
        try {
          await connectToDatabase();
          let dbUser = await User.findOne({ email: user.email });
          if (!dbUser) {
            await User.create({ email: user.email });
          }
        } catch (error) {
          console.error("Error creating user in DB during signIn:", error);
        }
      }
      return true;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      // @ts-ignore
      session.accessToken = token.accessToken;
      
      if (session.user?.email) {
        try {
          await connectToDatabase();
          const dbUser = await User.findOne({ email: session.user.email });
          if (dbUser) {
            // Reset runs counter if we've crossed into a new month
            const now = new Date();
            const resetAt = new Date(dbUser.runsResetAt || now);
            if (now > resetAt) {
              const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
              dbUser.runsThisMonth = 0;
              dbUser.runsResetAt = nextReset;
              await dbUser.save();
            }

            // Compute active Pro status from subscription expiry
            const isActivePro = dbUser.plan === 'pro' && 
              dbUser.subscriptionExpiry && 
              new Date() < new Date(dbUser.subscriptionExpiry);

            // @ts-ignore
            session.user.isPro = isActivePro;
            // @ts-ignore
            session.user.plan = dbUser.plan || 'free';
            // @ts-ignore
            session.user.planType = dbUser.planType || 'none';
            // @ts-ignore
            session.user.runsThisMonth = dbUser.runsThisMonth || 0;
            // @ts-ignore
            session.user.maxRuns = isActivePro ? 10 : 2;
            
            // Calculate remaining pool
            const poolLimit = isActivePro ? 1000 : 100;
            const commitsUsedThisMonth = dbUser.commitsThisMonth || 0;
            const remainingCommits = Math.max(0, poolLimit - commitsUsedThisMonth);
            
            // @ts-ignore
            session.user.maxCommits = remainingCommits;
            // @ts-ignore
            session.user.poolLimit = poolLimit;
            // @ts-ignore
            session.user.commitsUsedThisMonth = commitsUsedThisMonth;
            
            // @ts-ignore
            session.user.freeRunsUsed = dbUser.freeRunsUsed || 0;
            // @ts-ignore
            session.user.freeCommitsUsed = dbUser.freeCommitsUsed || 0;
            // @ts-ignore
            session.user.subscriptionExpiry = dbUser.subscriptionExpiry?.toISOString() || null;
          }
        } catch (error) {
          console.error("Error fetching user from DB for session:", error);
        }
      }
      
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

