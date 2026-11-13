import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_DOMAIN = "redteam.com";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // 8h absolute

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // `hd` hint pre-filters Google's account picker to the Workspace
      // domain. The signIn callback below is the real enforcement.
      authorization: { params: { hd: ALLOWED_DOMAIN } },
    }),
  ],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    async signIn({ profile }) {
      // Belt-and-suspenders: re-check the Workspace domain server-side in
      // case the OAuth consent screen is ever changed from "Internal".
      return (
        profile?.email_verified === true &&
        profile?.hd === ALLOWED_DOMAIN &&
        (profile.email?.endsWith(`@${ALLOWED_DOMAIN}`) ?? false)
      );
    },
    async jwt({ token, account }) {
      // Enforce an absolute session lifetime: the JWT is not extended past
      // 8h from the original sign-in, even with activity.
      if (account) token.absoluteExpiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
      if (typeof token.absoluteExpiresAt !== "number" || Date.now() >= token.absoluteExpiresAt) {
        return null;
      }
      return token;
    },
  },
});
