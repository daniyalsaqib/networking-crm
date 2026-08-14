"use client";

import { formStyles as styles } from "./formStyles";

const BASE_TAGS = ["Friend", "Professional", "APC", "Family", "Business"];

/**
 * Standard manual-add form template. Phone field is passed in from the parent
 * so Suffian's country-code UI stays untouched in NetworkMapClient.
 */
export default function ManualAddForm({
  manual,
  setManual,
  onSubmit,
  phoneField,
  zones,
}) {
  return (
    <section style={styles.panel}>
      <header style={styles.panelHeader}>
        <span style={styles.panelStep}>02</span>
        <div>
          <h2 style={styles.panelTitle}>Add one manually</h2>
          <p style={styles.panelDesc}>
            Fill in contact details below. Phone uses the country code picker.
          </p>
        </div>
      </header>

      <form
        style={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel} htmlFor="contact-name">
            Name
          </label>
          <input
            id="contact-name"
            style={styles.input}
            placeholder="Full name"
            value={manual.name}
            onChange={(e) => setManual({ ...manual, name: e.target.value })}
            required
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>Contact</label>
          <div style={styles.formRow}>
            <div style={styles.formRowItem}>{phoneField}</div>
            <div style={styles.formRowItem}>
              <input
                style={styles.input}
                placeholder="Email"
                type="email"
                value={manual.email}
                onChange={(e) => setManual({ ...manual, email: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>Location</label>
          <div style={styles.formRow}>
            <div style={styles.formRowItem}>
              <input
                style={styles.input}
                placeholder="City"
                value={manual.city}
                onChange={(e) => setManual({ ...manual, city: e.target.value })}
              />
            </div>
            <div style={styles.formRowItem}>
              <input
                style={styles.input}
                list="zone-list"
                placeholder="Area (e.g. DHA)"
                value={manual.area}
                onChange={(e) => setManual({ ...manual, area: e.target.value })}
              />
              <datalist id="zone-list">
                {zones.map((z) => (
                  <option key={z.id} value={z.name} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel}>Tags</label>
          <div style={styles.tagFilterRow}>
            {BASE_TAGS.map((t) => {
              const active = manual.tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setManual({
                      ...manual,
                      tags: active
                        ? manual.tags.filter((x) => x !== t)
                        : [...manual.tags, t],
                    })
                  }
                  style={{
                    ...styles.tagChip,
                    borderColor: active ? "#D9A441" : "#2A303B",
                    color: active ? "#D9A441" : "#B7B4AA",
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.fieldLabel} htmlFor="contact-notes">
            Notes
          </label>
          <input
            id="contact-notes"
            style={styles.input}
            placeholder="Optional notes"
            value={manual.notes}
            onChange={(e) => setManual({ ...manual, notes: e.target.value })}
          />
        </div>

        <button type="submit" style={styles.primaryBtn}>
          Add contact
        </button>
      </form>
    </section>
  );
}
