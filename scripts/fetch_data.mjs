/* ============================================================
   fetch_data.mjs — pulls real NBA players + per-game stats from
   API-NBA (api-sports.io, free tier) and writes src/players.json
   in the exact shape the app expects.

   Free tier = 100 requests/day, so we fetch stats team-by-team
   (~30-60 calls) and compute each player's per-game averages here.

   Grades / impact ratings are ESTIMATED from box-score stats.
   Salaries are estimated unless overridden in src/overrides.csv.

   Run by GitHub Actions on a schedule — you never run it by hand.
   Self-test (no network):  node scripts/fetch_data.mjs --selftest
   ============================================================ */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const BASE = "https://v2.nba.api-sports.io";
const KEY = process.env.BDL_API_KEY; // secret name kept as-is; holds your API-Sports key
const MAX_PAGES_PER_TEAM = 2;        // page cap to stay under the daily request budget (~61 calls)
const DELAY_MS = 6500;               // ~9 calls/min, safely under the free per-minute limit

function currentSeason() {
  const d = new Date();
  return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; // 2025-26 -> 2025
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function parseMin(m) {
  if (typeof m === "number") return m;
  if (typeof m === "string" && m.includes(":")) return parseFloat(m.split(":")[0]) || 0;
  return parseFloat(m) || 0;
}

/* ---- aggregated season averages -> the player object the app uses ---- */
function buildPlayer(a) {
  const ts = a.fga + a.fta > 0 ? r1((a.pts / (2 * (a.fga + 0.44 * a.fta))) * 100) : 0;
  const tp = a.tpa > 0 ? r1((a.tpm / a.tpa) * 100) : 0;
  const { pts, reb, ast, stl, blk, tov, mpg } = a;

  const val =
    0.85 * pts + 1.1 * ast + 0.65 * reb + 1.5 * stl + 1.5 * blk -
    0.9 * tov + 9 * (ts / 100 - 0.55) + 3 * (tp / 100 - 0.3);
  const grade = clamp(Math.round(38 + val * 1.5), 30, 99);

  const off = 0.85 * pts + 1.1 * ast + 0.4 * a.oreb + 9 * (ts / 100 - 0.55) - 0.7 * tov;
  const def = 1.6 * stl + 1.5 * blk + 0.18 * a.dreb;
  const obpm = clamp(r2((off - 11) * 0.45), -6, 11);
  const dbpm = clamp(r2((def - 2.4) * 0.8), -4, 6);
  const bpm = r1(obpm + dbpm);

  let arch = "Role Player";
  if (grade >= 86) arch = "Superstar";
  else if (ast >= 6) arch = "Floor General";
  else if (blk >= 1.4) arch = "Rim Protector";
  else if (reb >= 9) arch = "Rebounding Big";
  else if (tp >= 38 && pts < 16) arch = "3&D Role";
  else if (pts >= 18) arch = "Scorer";
  else if (grade >= 72) arch = "Two-Way Wing";

  const pos = (a.pos || "F").trim().toUpperCase().charAt(0);
  const salary = clamp(Math.round((grade - 52) * 1.5 + pts * 0.4), 1, 55);

  return {
    id: a.id, name: a.name, arch,
    pos: ["G", "F", "C"].includes(pos) ? pos : "F",
    team: a.team || "FA", age: null,
    salary, salaryReal: false,
    mpg: r1(mpg), pts: r1(pts), reb: r1(reb), ast: r1(ast),
    stl: r1(stl), blk: r1(blk), tov: r1(tov),
    tp, ts, obpm, dbpm, bpm, grade,
  };
}

/* ---- overrides (real salaries / advanced metrics), unchanged ---- */
const normName = (n) =>
  (n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (!lines.length) return [];
  const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(","); const row = {};
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
    if (!o) continue; count++;
    if (o.salary !== undefined && o.salary !== "") { p.salary = +o.salary; p.salaryReal = true; }
    const hasAdv = (o.obpm !== undefined && o.obpm !== "") || (o.dbpm !== undefined && o.dbpm !== "");
    if (hasAdv) {
      if (o.obpm !== "") p.obpm = +o.obpm;
      if (o.dbpm !== "") p.dbpm = +o.dbpm;
      p.bpm = r1(p.obpm + p.dbpm);
      p.grade = clamp(Math.round(62 + p.bpm * 3.4), 30, 99);
      p.advReal = true;
    }
  }
  return { players, count };
}

/* ---- API-NBA fetch (api-sports returns HTTP 200 even on errors, so we
        must inspect body.errors, not just the status code) ---- */
async function apiGet(path, attempt = 1) {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": KEY } });
    if (res.status === 429 && attempt <= 2) {
      console.log("Rate limited — waiting 20s then retrying…");
      await sleep(20000);
      return apiGet(path, attempt + 1);
    }
    const body = await res.json();
    const errs = body.errors;
    const hasErr = errs && (Array.isArray(errs) ? errs.length : Object.keys(errs).length);
    if (hasErr) throw new Error(`API error on ${path}: ${JSON.stringify(errs)}`);
    return body;
  } catch (e) {
    if (attempt <= 2) { await sleep(8000); return apiGet(path, attempt + 1); }
    throw e;
  }
}

function aggregate(rows) {
  const byId = new Map();
  for (const row of rows) {
    const min = parseMin(row.min);
    if (!row.player?.id || min <= 0) continue;
    const id = row.player.id;
    let p = byId.get(id);
    if (!p) {
      p = {
        id, name: `${row.player.firstname || ""} ${row.player.lastname || ""}`.trim(),
        team: row.team?.code || "FA", pos: row.pos || "",
        gp: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0,
        oreb: 0, dreb: 0, fga: 0, fta: 0, tpm: 0, tpa: 0,
      };
      byId.set(id, p);
    }
    p.gp++; p.min += min;
    p.pts += +row.points || 0;
    p.reb += +row.totReb || 0;
    p.oreb += +row.offReb || 0;
    p.dreb += +row.defReb || 0;
    p.ast += +row.assists || 0;
    p.stl += +row.steals || 0;
    p.blk += +row.blocks || 0;
    p.tov += +row.turnovers || 0;
    p.fga += +row.fga || 0;
    p.fta += +row.fta || 0;
    p.tpm += +row.tpm || 0;
    p.tpa += +row.tpa || 0;
    if (row.pos) p.pos = row.pos;          // keep a non-empty position
    if (row.team?.code) p.team = row.team.code; // latest team seen
  }
  // convert totals -> per-game averages
  return [...byId.values()].map((p) => ({
    id: p.id, name: p.name, team: p.team, pos: p.pos,
    mpg: p.min / p.gp,
    pts: p.pts / p.gp, reb: p.reb / p.gp, ast: p.ast / p.gp,
    stl: p.stl / p.gp, blk: p.blk / p.gp, tov: p.tov / p.gp,
    oreb: p.oreb / p.gp, dreb: p.dreb / p.gp,
    fga: p.fga / p.gp, fta: p.fta / p.gp, tpm: p.tpm / p.gp, tpa: p.tpa / p.gp,
  }));
}

async function run() {
  if (!KEY) throw new Error("Missing BDL_API_KEY environment variable.");
  const season = currentSeason();
  console.log(`Fetching NBA season ${season} from API-NBA…`);

  const teamsBody = await apiGet(`/teams`);
  const teams = (teamsBody.response || []).filter((t) => t.nbaFranchise === true && !t.allStar);
  console.log(`Found ${teams.length} NBA teams.`);
  if (!teams.length) throw new Error("No teams returned — check the API key/plan.");

  let allRows = [];
  let calls = 1;
  for (const t of teams) {
    let page = 1, totalPages = 1;
    do {
      const body = await apiGet(`/players/statistics?team=${t.id}&season=${season}&page=${page}`);
      calls++;
      allRows = allRows.concat(body.response || []);
      totalPages = body.paging?.total || 1;
      page++;
      await sleep(DELAY_MS);
    } while (page <= totalPages && page <= MAX_PAGES_PER_TEAM);
  }
  console.log(`Pulled ${allRows.length} game-stat rows in ${calls} requests.`);

  const agg = aggregate(allRows);
  let players = agg.map(buildPlayer).filter((p) => p.mpg >= 8);
  console.log(`Built ${players.length} players from the API.`);

  const { count } = applyOverrides(players);
  console.log(count ? `Merged ${count} manual overrides.` : "No overrides.csv matches — salaries/advanced estimated.");

  players.sort((a, b) => b.grade - a.grade);
  const path = "src/players.json";
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(players, null, 0));
  console.log(`Wrote ${players.length} players to ${path}.`);
}

/* ---- self-test: no network, verify aggregation + grades ---- */
function selftest() {
  const mkRow = (over) => ({
    player: { id: over.id, firstname: over.fn, lastname: over.ln },
    team: { code: over.tm }, pos: over.pos, min: over.min,
    points: over.pts, totReb: over.reb, offReb: over.oreb, defReb: over.dreb,
    assists: over.ast, steals: over.stl, blocks: over.blk, turnovers: over.tov,
    fga: over.fga, fta: over.fta, tpm: over.tpm, tpa: over.tpa,
  });
  // two games each for a star and a role player
  const rows = [
    mkRow({ id: 1, fn: "Star", ln: "Player", tm: "ATX", pos: "G", min: "36", pts: 30, reb: 8, oreb: 1, dreb: 7, ast: 9, stl: 1.5, blk: 0.6, tov: 3, fga: 20, fta: 9, tpm: 3, tpa: 8 }),
    mkRow({ id: 1, fn: "Star", ln: "Player", tm: "ATX", pos: "G", min: "34", pts: 26, reb: 8, oreb: 1, dreb: 7, ast: 7, stl: 1.5, blk: 0.6, tov: 3, fga: 18, fta: 7, tpm: 3, tpa: 8 }),
    mkRow({ id: 2, fn: "Role", ln: "Guy", tm: "BAY", pos: "F", min: "26", pts: 9, reb: 4, oreb: 1, dreb: 3, ast: 1.5, stl: 1.1, blk: 0.7, tov: 0.9, fga: 6.5, fta: 1.5, tpm: 1.6, tpa: 4 }),
    mkRow({ id: 2, fn: "Role", ln: "Guy", tm: "BAY", pos: "F", min: "26", pts: 9, reb: 4, oreb: 1, dreb: 3, ast: 1.5, stl: 1.1, blk: 0.7, tov: 0.9, fga: 6.5, fta: 1.5, tpm: 1.6, tpa: 4 }),
    mkRow({ id: 3, fn: "Did", ln: "NotPlay", tm: "CHI", pos: "C", min: "0", pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fga: 0, fta: 0, tpm: 0, tpa: 0 }),
  ];
  const players = aggregate(rows).map(buildPlayer);
  for (const p of players)
    console.log(`${p.name.padEnd(14)} g?  grade=${p.grade} pts=${p.pts} ast=${p.ast} ts=${p.ts}% bpm=${p.bpm} arch=${p.arch} pos=${p.pos} $${p.salary}M`);
  console.log(`(DNP player correctly excluded: ${players.find((p) => p.name === "Did NotPlay") ? "NO — bug" : "yes"})`);
}

if (process.argv.includes("--selftest")) selftest();
else run().catch((e) => { console.error(e.message); process.exit(1); });
