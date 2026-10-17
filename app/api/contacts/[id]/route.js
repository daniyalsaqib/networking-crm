import pool from "../../../../lib/db";
import { NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/getSessionUser";
import { rateLimit } from "../../../../lib/rateLimit";

export async function PATCH(request, { params }) {
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

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id } = params;

  // Validate and enforce string types and length limits for all string fields
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 200) {
      return NextResponse.json(
        { error: "Name must be a non-empty string (max 200 characters)." },
        { status: 400 }
      );
    }
    body.name = body.name.trim();
  }

  const stringFields = [
    { key: "phone", max: 30 },
    { key: "email", max: 254 },
    { key: "city", max: 100 },
    { key: "area", max: 100 },
    { key: "notes", max: 5000 },
  ];

  for (const { key, max } of stringFields) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "string") {
        return NextResponse.json(
          { error: `Field '${key}' must be a string.` },
          { status: 400 }
        );
      }
      if (body[key].length > max) {
        return NextResponse.json(
          { error: `Field '${key}' exceeds maximum allowed length of ${max} characters.` },
          { status: 400 }
        );
      }
    }
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      return NextResponse.json(
        { error: "Tags must be an array of strings." },
        { status: 400 }
      );
    }
    const cleanTags = [];
    for (const t of body.tags) {
      if (typeof t !== "string") {
        return NextResponse.json(
          { error: "Each tag must be a string." },
          { status: 400 }
        );
      }
      const trimmed = t.trim();
      if (trimmed) {
        if (trimmed.length > 50) {
          return NextResponse.json(
            { error: "Tags cannot exceed 50 characters." },
            { status: 400 }
          );
        }
        cleanTags.push(trimmed);
        if (cleanTags.length >= 50) break; // Stop processing tags after 50 valid entries
      }
    }
    body.tags = cleanTags;
  }

  const fields = ["name", "phone", "email", "city", "area", "tags", "notes"];
  const updates = [];
  const values = [];
  let i = 1;

  for (const field of fields) {
    if (field in body) {
      updates.push(`${field} = $${i}`);
      values.push(body[field]);
      i++;
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    values.push(id, user.id);
    const { rows } = await pool.query(
      `UPDATE contacts SET ${updates.join(", ")} WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("PATCH /api/contacts/[id] error:", err);
    return NextResponse.json({ error: "Failed to update contact." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (rateLimit(user.id + ":contact_write", 60)) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  try {
    const { id } = params;
    const { rowCount } = await pool.query("DELETE FROM contacts WHERE id = $1 AND user_id = $2", [id, user.id]);
    
    if (rowCount === 0) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/contacts/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete contact." }, { status: 500 });
  }
}
