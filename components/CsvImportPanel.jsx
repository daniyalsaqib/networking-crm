"use client";

import { useState } from "react";
import { parseGoogleContactsCsv } from "../lib/parseGoogleContactsCsv";
import { formStyles as styles } from "./formStyles";

export default function CsvImportPanel({ onImport }) {
  const [csvText, setCsvText] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState(null);

  function runImportPreview() {
    setParseError(null);
    try {
      const rows = parseGoogleContactsCsv(csvText);
      setImportPreview(rows);
      if (rows.length === 0) {
        setParseError(
          "No contacts found. Check that you pasted a Google Contacts CSV export."
        );
      }
    } catch (e) {
      setImportPreview(null);
      setParseError(e.message || "Failed to parse CSV.");
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(String(ev.target?.result || ""));
      setImportPreview(null);
      setParseError(null);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function confirmImport() {
    if (!importPreview?.length) return;
    setImporting(true);
    try {
      await onImport(importPreview);
      setImportPreview(null);
      setCsvText("");
      setParseError(null);
    } finally {
      setImporting(false);
    }
  }

  return (
    <section style={styles.panel}>
      <header style={styles.panelHeader}>
        <span style={styles.panelStep}>01</span>
        <div>
          <h2 style={styles.panelTitle}>Import from Google Contacts</h2>
          <p style={styles.panelDesc}>
            Export your contacts as CSV from Google, then upload the file or paste
            its contents below.
          </p>
        </div>
      </header>

      <div style={styles.fileRow}>
        <label style={styles.fileLabel}>
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileSelect}
            style={styles.fileInput}
          />
        </label>
      </div>

      <textarea
        style={styles.textarea}
        placeholder="Name,Given Name,Family Name,E-mail 1 - Label,E-mail 1 - Value,Phone 1 - Label,Phone 1 - Value..."
        value={csvText}
        onChange={(e) => {
          setCsvText(e.target.value);
          setImportPreview(null);
          setParseError(null);
        }}
      />

      <div style={styles.actionRow}>
        <button
          style={styles.primaryBtn}
          onClick={runImportPreview}
          disabled={!csvText.trim()}
        >
          Preview import
        </button>
        {importPreview && (
          <span style={styles.hint}>
            {importPreview.length} contact{importPreview.length !== 1 ? "s" : ""}{" "}
            found
          </span>
        )}
      </div>

      {parseError && <div style={styles.parseError}>{parseError}</div>}

      {importPreview && importPreview.length > 0 && (
        <div style={{ marginTop: "0.75rem" }}>
          <div style={styles.previewBox}>
            {importPreview.slice(0, 8).map((p, i) => (
              <div key={i}>
                {p.name}
                {p.phone && ` · ${p.phone}`}
                {p.email && ` · ${p.email}`}
              </div>
            ))}
            {importPreview.length > 8 && (
              <div>+ {importPreview.length - 8} more</div>
            )}
          </div>
          <button
            style={{ ...styles.primaryBtn, marginTop: "0.75rem" }}
            onClick={confirmImport}
            disabled={importing}
          >
            {importing
              ? "Importing..."
              : `Add ${importPreview.length} contacts`}
          </button>
        </div>
      )}
    </section>
  );
}
