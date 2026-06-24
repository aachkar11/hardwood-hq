/* ============================================================
   fetch_data.mjs — pulls real NBA players + per-game stats from
   BALLDONTLIE (free tier) and writes src/players.json in the
   exact shape the app expects.

   Grades / impact ratings are ESTIMATED from box-score stats
   (the free tier has no advanced metrics). Salaries are estimated
   from production unless the paid contracts endpoint is available.

   Run by GitHub Actions on a schedule — you never run it by hand.
   Self-test (no network):  node scripts/fetch_data.mjs --selftest
   ============================================================ */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const API = "https://api.balldontlie.io/nba/v1";
const KEY = process.env.BDL_API_KEY;

/* current NBA season in BALLDONTLIE terms: 2025-26 -> 2025 */
function currentSeason() {
  const d = new Date();
  return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

/* minutes can arrive as "34:12" or a number */
function parseMin(m) {
  if (typeof m === "number") return m;
  if (typeof m === "string" && m.includes(":")) return parseFloat(m.split(":")[0]) || 0;
  return parseFloat(m) || 0;
}

/* ---- the transform: real box stats -> the player object the app uses ---- */
function toPlayer(info, s) {
  const pts = +s.pts || 0, reb = +s.reb || 0, ast = +s.ast || 0;
  const stl = +s.stl || 0, blk = +s.blk || 0, tov = +s.turnover || 0;
  const oreb = +s.oreb || 0, dreb = +s.dreb || (reb - oreb) || 0;
  const fga = +s.fga || 0, fta = +s.fta || 0;
  const tp = +((s.fg3_pct || 0) * 100).toFixed(1);
  const mpg = r1(parseMin(s.min));
  const ts = fga + fta > 0 ? r1((pts / (2 * (fga + 0.44 * fta))) * 100) : 0;

  // estimated overall value -> grade
  const val =
    0.85 * pts + 1.1 * ast + 0.65 * reb + 1.5 * stl + 1.5 * blk -
    0.9 * tov + 9 * (ts / 100 - 0.55) + 3 * (tp / 100 - 0.3);
  const grade = clamp(Math.round(38 + val * 1.5), 30, 99);

  // split into offense / defense impact estimates (BPM-like)
  const off = 0.85 * pts + 1.1 * ast + 0.4 * oreb + 9 * (ts / 100 - 0.55) - 0.7 * tov;
  const def = 1.6 * stl + 1.5 * blk + 0.18 * dreb;
  const obpm = clamp(r2((off - 11) * 0.45), -6, 11);
  const dbpm = clamp(r2((def - 2.4) * 0.8), -4, 6);
  const bpm = r1(obpm + dbpm);

  // role label from the stat profile
  let arch = "Role Player";
  if (grade >= 86) arch = "Superstar";
  else if (ast >= 6) arch = "Floor General";
  else if (blk >= 1.4) arch = "Rim Protector";
  else if (reb >= 9) arch = "Rebounding Big";
  else if (tp >= 38 && pts < 16) arch = "3&D Role";
  else if (pts >= 18) arch = "Scorer";
  else if (grade >= 72) arch = "Two-Way Wing";

  const pos = (info.position || "F").trim().toUpperCase().charAt(0);
  const salary = clamp(Math.round((grade - 52) * 1.5 + pts * 0.4), 1, 55);

  return {
    id: info.id,
    name: `${info.first_name} ${info.last_name}`.trim(),
    arch,
    pos: ["G", "F", "C"].includes(pos) ? pos : "F",
    team: info.team?.abbreviation || "FA",
    age: info.age ?? null,
    salary,            // ESTIMATED unless real contracts available
    salaryReal: false,
    mpg,
    pts: r1(pts), reb: r1(reb), ast: r1(ast),
    stl: r1(stl), blk: r1(blk), tov: r1(tov),
    tp, ts,
    obpm, dbpm, bpm,
    grade,
  };
}

/* ---- optional manual overrides (real salaries / advanced metrics) ----
   You fill src/overrides.csv yourself from a permitted source (e.g. a
   personal Basketball Reference CSV export). Columns, any subset:
     name,salary,obpm,dbpm
   Matched to players by name. Anything you don't provide stays estimated. */
const normName = (n) =>
  (n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (!lines.length) return [];
  const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    head.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

function applyOverrides(players) {
  const path = "src/overrides.csv";
  if (!existsSync(path)) return { players, count: 0 };
  const rows = parseCSV(readFileSync(path, "utf8"));
  const byName = new Map(rows.filter((r) => r.name).map((r) => [normName(r.name), r]));
  let count = 0;
  for (const p of players) {
    const o = byName.get(normName(p.name));
    if (!o) continue;
    count++;
    if (o.salary !== undefined && o.salary !== "") { p.salary = +o.salary; p.salaryReal = true; }
    const hasAdv = (o.obpm !== undefined && o.obpm !== "") || (o.dbpm !== undefined && o.dbpm !== "");
    if (hasAdv) {
      if (o.obpm !== "") p.obpm = +o.obpm;
      if (o.dbpm !== "") p.dbpm = +o.dbpm;
      p.bpm = r1(p.obpm + p.dbpm);
      p.grade = clamp(Math.round(62 + p.bpm * 3.4), 30, 99); // real BPM -> grade
      p.advReal = true;
    }
  }
  return { players, count };
}


async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: KEY } });
  if (!res.ok) throw new Error(`${res.status} on ${path}: ${await res.text()}`);
  return res.json();
}

async function pageAll(path) {
  let out = [], cursor = null, guard = 0;
  do {
    const url = `${path}${path.includes("?") ? "&" : "?"}per_page=100${cursor ? `&cursor=${cursor}` : ""}`;
    const j = await get(url);
    out = out.concat(j.data || []);
    cursor = j.meta?.next_cursor || null;
  } while (cursor && ++guard < 60);
  return out;
}

async function run() {
  if (!KEY) throw new Error("Missing BDL_API_KEY environment variable.");
  const season = currentSeason();
  console.log(`Fetching NBA season ${season}…`);

  const averages = await pageAll(`/season_averages/general?season=${season}&season_type=regular&type=base`);
  console.log(`Got ${averages.length} season-average rows.`);

  const players = averages
    .map((row) => {
      const info = row.player || row; // shape tolerance
      const stats = row.stats || row;
      if (!info?.id || !(info.first_name || info.last_name)) return null;
      return toPlayer(info, stats);
    })
    .filter(Boolean)
    .filter((p) => p.mpg >= 8) // drop deep-bench noise
    .sort((a, b) => b.grade - a.grade);

  console.log(`Built ${players.length} players from the API.`);
  const { count } = applyOverrides(players);
  console.log(count ? `Merged ${count} manual overrides (real salary/advanced).` : "No overrides.csv found — salaries/advanced are estimated.");
  players.sort((a, b) => b.grade - a.grade);

  console.log(`Wrote ${players.length} players.`);
  const path = "src/players.json";
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(players, null, 0));
}

/* ---- self-test: no network, verify the math ---- */
function selftest() {
  const cases = {
    star:  { player: { id: 1, first_name: "Star", last_name: "Player", position: "G", team: { abbreviation: "ATX" }, age: 27 },
             stats: { pts: 28, reb: 8, ast: 8, stl: 1.5, blk: 0.6, turnover: 3.2, oreb: 1, dreb: 7, fga: 19, fta: 8, fg3_pct: 0.38, min: "36:00" } },
    role:  { player: { id: 2, first_name: "Role", last_name: "Guy", position: "F", team: { abbreviation: "BAY" }, age: 26 },
             stats: { pts: 9, reb: 4, ast: 1.5, stl: 1.1, blk: 0.7, turnover: 0.9, oreb: 1, dreb: 3, fga: 6.5, fta: 1.5, fg3_pct: 0.40, min: "26:00" } },
    big:   { player: { id: 3, first_name: "Rim", last_name: "Protector", position: "C", team: { abbreviation: "CHI" }, age: 25 },
             stats: { pts: 12, reb: 11, ast: 1.8, stl: 0.7, blk: 2.4, turnover: 1.6, oreb: 3, dreb: 8, fga: 8, fta: 4, fg3_pct: 0.0, min: "30:00" } },
    scrub: { player: { id: 4, first_name: "Deep", last_name: "Bench", position: "G", team: { abbreviation: "DEN" }, age: 24 },
             stats: { pts: 4, reb: 2, ast: 1.2, stl: 0.4, blk: 0.2, turnover: 0.8, oreb: 0.5, dreb: 1.5, fga: 4, fta: 1, fg3_pct: 0.31, min: "14:00" } },
  };
  const built = [];
  for (const [k, v] of Object.entries(cases)) {
    const p = toPlayer(v.player, v.stats);
    built.push(p);
    console.log(`${k.padEnd(6)} grade=${p.grade}  obpm=${p.obpm}  dbpm=${p.dbpm}  bpm=${p.bpm}  arch=${p.arch}  pos=${p.pos}  $${p.salary}M  (estimated)`);
  }
  const { count } = applyOverrides(built);
  console.log(`\nAfter overrides (${count} matched):`);
  for (const p of built) {
    console.log(`${p.name.padEnd(16)} grade=${p.grade}  bpm=${p.bpm}  $${p.salary}M  salaryReal=${!!p.salaryReal} advReal=${!!p.advReal}`);
  }
}

if (process.argv.includes("--selftest")) selftest();
else run().catch((e) => { console.error(e.message); process.exit(1); });
