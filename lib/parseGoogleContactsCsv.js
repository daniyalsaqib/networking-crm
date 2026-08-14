/**
 * Parse a Google Contacts CSV export into contact objects for bulk import.
 */

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Prefer "Phone 1 - Value" over "Phone 1 - Label". */
function findValueColumnIndex(header, field) {
  const matches = header
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => {
      const lower = h.toLowerCase();
      if (field === "phone") return lower.includes("phone");
      if (field === "email") {
        return lower.includes("e-mail") || lower.includes("email");
      }
      return false;
    });

  if (matches.length === 0) return -1;

  const valueCol = matches.find(({ h }) => /-\s*value/i.test(h));
  if (valueCol) return valueCol.i;

  const nonLabel = matches.find(({ h }) => !/-\s*label/i.test(h));
  if (nonLabel) return nonLabel.i;

  return matches[0].i;
}

function findNameColumnIndex(header) {
  return header.findIndex((h) => h === "name");
}

function findFirstNameColumnIndex(header) {
  return header.findIndex(
    (h) => h.includes("first name") || h.includes("given name")
  );
}

function findLastNameColumnIndex(header) {
  return header.findIndex(
    (h) => h.includes("last name") || h.includes("family name")
  );
}

function findOrgColumnIndex(header) {
  return header.findIndex((h) => h.includes("organization name"));
}

export function parseGoogleContactsCsv(text) {
  const normalized = text.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map((h) =>
    h.replace(/^\uFEFF/, "").toLowerCase()
  );

  const nameIdx = findNameColumnIndex(header);
  const firstIdx = findFirstNameColumnIndex(header);
  const lastIdx = findLastNameColumnIndex(header);
  const orgIdx = findOrgColumnIndex(header);
  const phoneIdx = findValueColumnIndex(header, "phone");
  const emailIdx = findValueColumnIndex(header, "email");
  const areaIdx = header.findIndex((h) => h === "area");
  const cityIdx = header.findIndex((h) => h === "city");
  const tagsIdx = header.findIndex((h) => h === "tags");

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);

    let name = "";
    if (nameIdx >= 0 && cells[nameIdx]) {
      name = cells[nameIdx];
    } else {
      const first = firstIdx >= 0 ? cells[firstIdx] || "" : "";
      const last = lastIdx >= 0 ? cells[lastIdx] || "" : "";
      name = `${first} ${last}`.trim();
    }

    if (!name && orgIdx >= 0 && cells[orgIdx]) {
      name = cells[orgIdx];
    }
    if (!name) continue;

    rows.push({
      name,
      phone: phoneIdx >= 0 ? cells[phoneIdx] || "" : "",
      email: emailIdx >= 0 ? cells[emailIdx] || "" : "",
      area: areaIdx >= 0 ? cells[areaIdx] || "" : "",
      city: cityIdx >= 0 ? cells[cityIdx] || "Lahore" : "Lahore",
      tags:
        tagsIdx >= 0 && cells[tagsIdx]
          ? cells[tagsIdx].split("|").filter(Boolean)
          : [],
    });
  }

  return rows;
}
