# AMTEC Agricultural Machinery Data

An interactive web catalogue for browsing, searching, and comparing technical specifications of agricultural machines tested by the **Agricultural Machinery Testing and Evaluation Center (AMTEC)** at UPLB.

![Platform](https://img.shields.io/badge/Platform-WordPress%20Plugin-blue)
![Data Source](https://img.shields.io/badge/Data-Google%20Sheets%20(Live)-green)

---

## ✨ Features

- **Category Browser** — Machines grouped by type (e.g. Four-Wheel Tractor, Hammer Mill), each with its own Google Sheets tab.
- **Full-Text Search** — Instantly search across all specification fields with live-updating results and match highlighting.
- **Brand Filter** — Filter machines by manufacturer via dropdown.
- **Side-by-Side Comparison** — Compare any two machines from the same category, with an option to show differences only.
- **Shareable Links** — Deep-link directly to a category or a specific comparison via URL hash.
- **CSV Export** — Download any comparison as a spreadsheet-ready `.csv` file.
- **Print Bulletin** — One-click printable technical bulletin with AMTEC/UPLB header, machine photo, and full spec table.
- **Live Data** — Data is fetched from a published Google Sheets document. No database required — edit the sheet to update the site.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (for the local dev server)
- A modern web browser

### Run Locally

```bash
# Clone the repository
git clone <repo-url>
cd technical-bulletin-machines

# Serve with any static server (e.g. npx serve)
npx -y serve . -l 3000
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
technical-bulletin-machines/
├── index.html          # Main single-page application
├── app.js              # Core application logic (routing, data fetching, rendering)
├── styles.css          # Full stylesheet (Navy + Golden Orange palette)
├── amtec-logo.png      # AMTEC logo (used in print bulletins)
├── uplb-logo.png       # UPLB logo (used in print bulletins)
├── Manual/
│   └── amtec-manual-guide.html   # Printable A4 user manual (12 pages)
└── README.md
```

---

## 🔧 Tech Stack

| Layer        | Technology                            |
| ------------ | ------------------------------------- |
| Frontend     | Vanilla HTML, CSS, JavaScript (ES modules) |
| Data Source   | Google Sheets (published as CSV)      |
| Deployment   | WordPress shortcode plugin (`[tech_bulletin_machines]`) |
| Fonts        | Inter (Google Fonts)                  |

---

## 📊 Data Management

All machine data is managed in a single **Google Sheets** document with two types of tabs:

1. **`Categories`** — Index sheet listing each machine category (`id`, `label`, `gid`, `icon`, `photo_url`).
2. **Machine data tabs** — One per category. Each machine is a **column**, each spec is a **row**. Column A contains spec labels.

### Adding a New Machine

1. Open the correct category tab in Google Sheets.
2. Insert a new column to the right.
3. Fill in Brand, Model, and all spec values.
4. Wait 2–3 minutes for Google Sheets to publish, then click **↺ Refresh** on the website.

> **Note:** The sheet must be published to the web (File → Share → Publish to web) as CSV for the system to read it.

---

## 📖 User Manual

A comprehensive 12-page A4 printable user manual is available at:

```
Manual/amtec-manual-guide.html
```

Open it in a browser and use **Print → Save as PDF** for a polished guide. It covers all features, admin tasks, and troubleshooting.

---

## 👥 Team

| Name                        | Role       |
| --------------------------- | ---------- |
| Aguilar, Rafael D.          | Developer  |
| De Guzman, John Lloyd M.    | Developer  |
| Presto, Sean Covi Q.        | Developer  |
| Espiritu, Angeline          | Developer  |

**LSPU SCC** — Laguna State Polytechnic University, Santa Cruz Campus

---

## 📄 License

This project was developed for AMTEC – UPLB. All rights reserved.
