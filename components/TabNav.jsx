"use client";

const TABS = [
  { id: "map", label: "Map" },
  { id: "directory", label: "Directory" },
  { id: "add", label: "Add / import" },
];

export default function TabNav({ active, onChange, styles }) {
  return (
    <nav style={styles.tabs} aria-label="Main navigation">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          style={{
            ...styles.tabBtn,
            ...(active === id ? styles.tabBtnActive : {}),
          }}
          aria-current={active === id ? "page" : undefined}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
