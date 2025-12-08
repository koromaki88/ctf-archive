// db.js — robust dual-mode (SQLite if present, JSON fallback) with no static imports

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Shared seed data
const seedItems = [
  ["Handmade Yunomi", 4500, "/images/yunomi.svg", "A small teacup that fits the hand."],
  ["Matcha Bowl (Chawan)", 12000, "/images/chawan.svg", "Attractive quiet glaze gradients."],
  ["Indigo Handkerchief", 2200, "/images/indigo.svg", "A calm indigo piece."],
  ["Nambu Iron Kettle (Small)", 18000, "/images/tetsubin.svg", "For mellow-tasting water."],
  ["Incense Holder", 1600, "/images/incense.svg", "A companion to a dignified scent."],
  ["Washi Notebook", 1800, "/images/washi.svg", "Handmade washi with a pleasant feel."]
];

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

let impl; // will hold { mode, allItems(), getItemsByIds() }

try {
  const BetterSqlite3 = require("better-sqlite3"); // will throw if not installed
  const dbPath = path.join(dataDir, "app.db");
  const db = new BetterSqlite3(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price_yen INTEGER NOT NULL,
      image TEXT NOT NULL,
      description TEXT DEFAULT ''
    );
  `);

  const count = db.prepare("SELECT COUNT(*) AS c FROM items").get().c;
  if (count === 0) {
    const ins = db.prepare("INSERT INTO items (name, price_yen, image, description) VALUES (?, ?, ?, ?)");
    const tx = db.transaction(() => { for (const r of seedItems) ins.run(...r); });
    tx();
  }

  impl = {
    mode: "sqlite",
    allItems() {
      return db.prepare("SELECT id, name, price_yen, image, description FROM items ORDER BY id").all();
    },
    getItemsByIds(ids) {
      if (!ids.length) return [];
      const q = `SELECT id, name, price_yen, image, description FROM items WHERE id IN (${ids.map(()=>"?" ).join(",")})`;
      return db.prepare(q).all(...ids);
    }
  };

} catch {
  // Fallback: JSON file; zero native deps
  const jsonPath = path.join(dataDir, "items.json");
  if (!fs.existsSync(jsonPath)) {
    const arr = seedItems.map((r, i) => ({ id: i + 1, name: r[0], price_yen: r[1], image: r[2], description: r[3] }));
    fs.writeFileSync(jsonPath, JSON.stringify(arr, null, 2), "utf8");
  }
  const readAll = () => JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  impl = {
    mode: "json",
    allItems() { return readAll(); },
    getItemsByIds(ids) {
      const all = readAll();
      const set = new Set(ids.map(Number));
      return all.filter(x => set.has(Number(x.id)));
    }
  };

  console.warn("[senmonten] better-sqlite3 not found — using JSON fallback at data/items.json");
}

export const allItems = (...a) => impl.allItems(...a);
export const getItemsByIds = (...a) => impl.getItemsByIds(...a);
export const storageMode = impl.mode;
