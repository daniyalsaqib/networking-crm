import pool from "../../../lib/db";
import { NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/getSessionUser";
import { rateLimit } from "../../../lib/rateLimit";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { rows } = await pool.query(
      "SELECT * FROM contacts WHERE user_id = $1 ORDER BY created_at DESC",
      [user.id]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/contacts error:", err);
    return NextResponse.json({ error: "Failed to fetch contacts." }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (rateLimit(user.id + ":contact_write", 60)) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const {
    name,
    phone = "",
    email = "",
    city = "Lahore",
    area = "",
    tags = [],
    notes = "",
  } = body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required and must be a non-empty string." }, { status: 400 });
  }

  if (typeof phone !== "string") {
    return NextResponse.json({ error: "Phone must be a string." }, { status: 400 });
  }
  if (typeof email !== "string") {
    return NextResponse.json({ error: "Email must be a string." }, { status: 400 });
  }
  if (typeof city !== "string") {
    return NextResponse.json({ error: "City must be a string." }, { status: 400 });
  }
  if (typeof area !== "string") {
    return NextResponse.json({ error: "Area must be a string." }, { status: 400 });
  }
  if (typeof notes !== "string") {
    return NextResponse.json({ error: "Notes must be a string." }, { status: 400 });
  }

  const cleanTags = [];
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (typeof t !== "string") {
        return NextResponse.json({ error: "Tags must be an array of strings." }, { status: 400 });
      }
      const trimmed = t.trim();
      if (trimmed) {
        if (trimmed.length > 50) {
          return NextResponse.json({ error: "Tags cannot exceed 50 characters." }, { status: 400 });
        }
        cleanTags.push(trimmed);
        if (cleanTags.length >= 50) break; // Stop processing tags after 50 valid entries
      }
    }
  } else if (tags !== undefined) {
    return NextResponse.json({ error: "Tags must be an array." }, { status: 400 });
  }

  if (
    name.length > 200 ||
    phone.length > 30 ||
    email.length > 254 ||
    city.length > 100 ||
    area.length > 100 ||
    notes.length > 5000
  ) {
    return NextResponse.json(
      { error: "Input exceeds maximum allowed length." },
      { status: 400 }
    );
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO contacts (name, phone, email, city, area, tags, notes, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name.trim(), phone, email, city, area, cleanTags, notes, user.id]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("POST /api/contacts error:", err);
    return NextResponse.json({ error: "Failed to create contact." }, { status: 500 });
  }
}

// Bulk import support: POST an array under shape { bulk: [...] }
export async function PUT(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (rateLimit(user.id + ":contact_bulk", 10)) {
    return NextResponse.json({ error: "Too many bulk import requests. Please slow down." }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const list = Array.isArray(body?.bulk) ? body.bulk : [];
  if (list.length === 0) {
    return NextResponse.json({ error: "No contacts provided" }, { status: 400 });
  }
  if (list.length > 1000) {
    return NextResponse.json({ error: "Maximum 1000 contacts per import." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = [];
    for (const c of list) {
      if (!c || !c.name || typeof c.name !== "string" || !c.name.trim()) continue;
      const cleanName = c.name.trim().slice(0, 200);
      const cleanPhone = typeof c.phone === "string" ? c.phone.slice(0, 30) : "";
      const cleanEmail = typeof c.email === "string" ? c.email.slice(0, 254) : "";
      const cleanCity = typeof c.city === "string" ? c.city.slice(0, 100) : "Lahore";
      const cleanArea = typeof c.area === "string" ? c.area.slice(0, 100) : "";

      // Stop processing tags after 50 valid entries
      const cleanTags = [];
      if (Array.isArray(c.tags)) {
        for (const t of c.tags) {
          if (typeof t === "string" && t.trim()) {
            cleanTags.push(t.trim().slice(0, 50));
            if (cleanTags.length >= 50) break; // Stop processing tags after 50 valid entries
          }
        }
      }

      const cleanNotes = typeof c.notes === "string" ? c.notes.slice(0, 5000) : "";

      const { rows } = await client.query(
        `INSERT INTO contacts (name, phone, email, city, area, tags, notes, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          cleanName,
          cleanPhone,
          cleanEmail,
          cleanCity,
          cleanArea,
          cleanTags,
          cleanNotes,
          user.id,
        ]
      );
      inserted.push(rows[0]);
    }
    await client.query("COMMIT");
    return NextResponse.json(inserted, { status: 201 });
  } catch (err) {
    // Wrap ROLLBACK in try/catch so a rollback failure never hides or masks the original error
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Transaction ROLLBACK failed:", rollbackErr);
    }
    console.error("Bulk import error:", err);
    return NextResponse.json({ error: "Import failed. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }
}
