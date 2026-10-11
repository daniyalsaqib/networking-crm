import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import pool from "./db";

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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const email = credentials.email.trim().toLowerCase();
        const { rows } = await pool.query(
          "SELECT * FROM users WHERE email = $1",
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
            "SELECT id, provider, google_id FROM users WHERE email = $1",
            [normalizedEmail]
          );

          if (byEmail.length > 0) {
            const existingUser = byEmail[0];

            // Do not replace an existing google_id if already linked to another Google account
            if (existingUser.google_id && existingUser.google_id !== googleSub) {
              return false;
            }

            user.id = existingUser.id;
            const updatedProvider = existingUser.provider.includes("google")
              ? existingUser.provider
              : `${existingUser.provider},google`;
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
                 provider = CASE WHEN users.provider NOT LIKE '%google%' THEN users.provider || ',google' ELSE users.provider END,
                 image = COALESCE(NULLIF(users.image, ''), EXCLUDED.image)
               WHERE users.google_id IS NULL OR users.google_id = EXCLUDED.google_id
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
  },
  secret: process.env.NEXTAUTH_SECRET,
};
