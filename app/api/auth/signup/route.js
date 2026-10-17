import pool from "../../../../lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { rateLimit, getIP } from "../../../../lib/rateLimit";

export async function POST(request) {
  const ip = getIP(request);
  if (rateLimit(ip + ":signup", 5)) {
    return NextResponse.json(
      { error: "Too many signup attempts. Please try again in a minute." },
      { status: 429 }
    );
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const { name, email, password } = body || {};

    if (
      typeof name !== "string" || !name.trim() ||
      typeof email !== "string" || !email.trim() ||
      typeof password !== "string" || password.length < 6
    ) {
      return NextResponse.json(
        { error: "Invalid input. Name, valid email, and password (at least 6 characters) are required." },
        { status: 400 }
      );
    }

    if (name.length > 120 || email.length > 254 || password.length > 128) {
      return NextResponse.json(
        { error: "Input exceeds maximum allowed length." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [
      normalizedEmail,
    ]);

    if (rows.length > 0) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();

    try {
      await pool.query(
        "INSERT INTO users (id, name, email, password, provider) VALUES ($1, $2, $3, $4, $5)",
        [id, name.trim(), normalizedEmail, hashedPassword, "credentials"]
      );
    } catch (dbError) {
      if (dbError.code === "23505") {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 409 }
        );
      }
      throw dbError;
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
