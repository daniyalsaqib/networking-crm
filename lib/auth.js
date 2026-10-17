import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import pool from "./db";
import { rateLimit, getIP } from "./rateLimit";

const isProduction = process.env.NODE_ENV === "production";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        if (
          typeof credentials.email !== "string" ||
          typeof credentials.password !== "string" ||
          credentials.email.length > 254 ||
          credentials.password.length > 128
        ) {
          return null;
        }

        const email = credentials.email.trim().toLowerCase();
        const clientIp = getIP(req);

        // Rate limit by client IP (overall brute-force barrier across accounts)
        if (rateLimit("login_ip:" + clientIp, 20)) {
          throw new Error("Too many login attempts from this IP. Please try again in a minute.");
        }

        // Rate limit by client IP + email.
        // An attacker cannot lock out an arbitrary user's email because only
        // the attacker's own IP will be blocked from attempting that email.
        if (rateLimit("login_ip_email:" + clientIp + ":" + email, 5)) {
          throw new Error("Too many login attempts for this account from your IP. Please try again in a minute.");
        }

        const { rows } = await pool.query(
          "SELECT id, name, email, image, password FROM users WHERE email = $1",
          [email]
        );
        const user = rows[0];
        
        if (!user) return null;
        if (!user.password) {
          throw new Error("This account uses Google sign-in. Please use the Google button.");
        }
        
        const passwordsMatch = await bcrypt.compare(credentials.password, user.password);
        if (!passwordsMatch) return null;
        
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image || "",
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account.provider === "google") {
        if (!profile?.email_verified) return false;

        const googleSub = profile?.sub || account?.providerAccountId;
        if (!googleSub) return false;

        const normalizedEmail = user.email.trim().toLowerCase();

        // 1. Identify account primarily by Google's permanent subject identifier (`sub`), not email
        const { rows: bySub } = await pool.query(
          "SELECT id FROM users WHERE google_id = $1",
          [googleSub]
        );

        if (bySub.length > 0) {
          user.id = bySub[0].id;

          // Check if the latest Google email conflicts with another user row
          const { rows: conflicting } = await pool.query(
            "SELECT id FROM users WHERE email = $1 AND id != $2",
            [normalizedEmail, user.id]
          );

          if (conflicting.length === 0) {
            await pool.query(
              `UPDATE users SET
                 email = $1,
                 name = COALESCE(NULLIF($2, ''), name),
                 image = COALESCE(NULLIF($3, ''), image)
               WHERE id = $4`,
              [normalizedEmail, user.name || "", user.image || "", user.id]
            );
          } else {
            // Email is held by another account: update name & image only to avoid unique constraint crash
            await pool.query(
              `UPDATE users SET
                 name = COALESCE(NULLIF($1, ''), name),
                 image = COALESCE(NULLIF($2, ''), image)
               WHERE id = $3`,
              [user.name || "", user.image || "", user.id]
            );
          }
        } else {
          // 2. If not yet linked by sub, check if account exists with this verified email
          const { rows: byEmail } = await pool.query(
            "SELECT id, provider, google_id, password FROM users WHERE email = $1",
            [normalizedEmail]
          );

          if (byEmail.length > 0) {
            const existingUser = byEmail[0];

            // Do not replace an existing google_id if already linked to another Google account
            if (existingUser.google_id && existingUser.google_id !== googleSub) {
              return false;
            }

            // Guard against a null or undefined provider
            const existingProvider = existingUser.provider || "";

            // Prevent taking over an unlinked credentials account without password verification
            if (existingUser.password && !existingProvider.includes("google")) {
              return false;
            }

            user.id = existingUser.id;
            const updatedProvider = existingProvider.includes("google")
              ? existingProvider
              : existingProvider ? `${existingProvider},google` : "google";

            await pool.query(
              `UPDATE users SET
                 google_id = COALESCE(google_id, $1),
                 provider = $2,
                 image = COALESCE(NULLIF(image, ''), $3)
               WHERE id = $4`,
              [googleSub, updatedProvider, user.image || "", user.id]
            );
          } else {
            // 3. New account: insert identified by google_id (sub)
            const id = crypto.randomUUID();
            const { rows: upserted } = await pool.query(
              `INSERT INTO users (id, name, email, google_id, image, provider)
               VALUES ($1, $2, $3, $4, $5, 'google')
               ON CONFLICT (email)
               DO UPDATE SET
                 google_id = COALESCE(users.google_id, EXCLUDED.google_id),
                 provider = CASE 
                   WHEN COALESCE(users.provider, '') NOT LIKE '%google%' 
                   THEN CASE WHEN users.provider IS NULL OR users.provider = '' THEN 'google' ELSE users.provider || ',google' END 
                   ELSE users.provider 
                 END,
                 image = COALESCE(NULLIF(users.image, ''), EXCLUDED.image)
               WHERE (users.google_id IS NULL OR users.google_id = EXCLUDED.google_id)
                 AND (users.password IS NULL OR COALESCE(users.provider, '') LIKE '%google%')
               RETURNING id`,
              [id, user.name || "", normalizedEmail, googleSub, user.image || ""]
            );

            if (!upserted.length) {
              // Existing account with this email has a conflicting google_id
              return false;
            }

            user.id = upserted[0].id;
          }
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60, // 1 hour max token lifetime
  },
  useSecureCookies: isProduction,
  cookies: {
    sessionToken: {
      name: isProduction
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
