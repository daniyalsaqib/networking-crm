import pool from "../../../lib/db";
import { NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/getSessionUser";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await pool.query(
    "SELECT * FROM contacts WHERE user_id = $1 ORDER BY created_at DESC",
    [user.id]
  );
  return NextResponse.json(rows);
}

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    name,
    phone = "",
    email = "",
    city = "Lahore",
    area = "",
    tags = [],
    notes = "",
  } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `INSERT INTO contacts (name, phone, email, city, area, tags, notes, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [name.trim(), phone, email, city, area, tags, notes, user.id]
  );
  return NextResponse.json(rows[0], { status: 201 });
}

// Bulk import support: POST an array to this same route under a different
// shape { bulk: [...] } so the CSV importer can insert many rows at once.
export async function PUT(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const list = Array.isArray(body.bulk) ? body.bulk : [];
  if (list.length === 0) {
    return NextResponse.json({ error: "No contacts provided" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = [];
    for (const c of list) {
      if (!c.name || !c.name.trim()) continue;
      const { rows } = await client.query(
        `INSERT INTO contacts (name, phone, email, city, area, tags, notes, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          c.name.trim(),
          c.phone || "",
          c.email || "",
          c.city || "Lahore",
          c.area || "",
          c.tags || [],
          c.notes || "",
          user.id,
        ]
      );
      inserted.push(rows[0]);
    }
    await client.query("COMMIT");
    return NextResponse.json(inserted, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
