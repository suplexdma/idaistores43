import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import User from "@/models/User";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Customer account",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        await connectToDatabase();
        const user = await User.findOne({ email }).select("+passwordHash");
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
          return null;
        }

        await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
        session.user.email = typeof token.email === "string" ? token.email : "";
        session.user.name = typeof token.name === "string" ? token.name : "";
      }
      return session;
    },
  },
};
