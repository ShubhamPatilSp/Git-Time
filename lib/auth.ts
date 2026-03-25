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
          const dbUser = await User.findOne({ email: session.user.email }).lean();
          if (dbUser) {
            // @ts-ignore
            session.user.isPro = dbUser.isPro;
            // @ts-ignore
            session.user.freeRunsUsed = dbUser.freeRunsUsed;
          }
        } catch (error) {
          console.error("Error fetching user from DB for session:", error);
        }
      }
      
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true, // Enables verbose logs in Render console
};

// Log presence of keys on server startup (not the values themselves)
console.log("NextAuth Configuration status:", {
  hasGithubId: !!process.env.GITHUB_ID,
  hasGithubSecret: !!process.env.GITHUB_SECRET,
  hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
  nextAuthUrl: process.env.NEXTAUTH_URL,
});
