import React, { useState, useMemo } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
} from "recharts";
import {
  Plus, X, TrendingUp, Shield, Zap, Target, DollarSign,
  Users, BarChart3, GitCompare, Lightbulb, AlertTriangle, ChevronRight,
} from "lucide-react";

/* ============================================================
   HARDWOOD HQ — front-office analytics terminal (prototype)
   All data below is SYNTHETIC sample data, generated from
   archetype templates so the models stay internally consistent.
   Swap in live data at the ROSTER_SOURCE marker (see notes).
   ============================================================ */

const C = {
  bg: "#0C0F14", panel: "#141A22", panel2: "#1B232E", line: "#28323F",
  text: "#E6EDF3", muted: "#8794A3", faint: "#5A6675",
  amber: "#F2853F", amberDim: "#5C3A22",
  cyan: "#36D1A6", cyanDim: "#1C4A40",
  blue: "#4DA3FF", red: "#E5534B", gold: "#E8B931",
};
const display = "'Arial Narrow','Helvetica Neue',system-ui,sans-serif";
const num = { fontVariantNumeric: "tabular-nums" };

/* ---------- seeded RNG so the league is stable across renders ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260623);
const rr = (lo, hi) => lo + rnd() * (hi - lo);
const ri = (lo, hi) => Math.round(rr(lo, hi));

/* ---------- archetypes: ranges keep stats & impact consistent ---------- */
const ARCH = [
  { k: "Superstar",     pos: ["G","F"], w: 4,  mpg:[35,38], pts:[26,32], reb:[5,11], ast:[5,9], stl:[1,2], blk:[0.4,1.6], tov:[2.8,3.8], tp:[35,40], ts:[60,64], ob:[6,9],  db:[1,3.5], age:[24,31], sal:[42,55] },
  { k: "All-Star Wing", pos: ["F","G"], w: 7,  mpg:[33,37], pts:[20,26], reb:[4,7],  ast:[3,6], stl:[1,1.8], blk:[0.3,1.0], tov:[2,3.2], tp:[36,41], ts:[57,61], ob:[3.5,6], db:[0.5,2.5], age:[23,30], sal:[28,42] },
  { k: "Floor General", pos: ["G"],     w: 7,  mpg:[31,36], pts:[14,20], reb:[3,5],  ast:[7,11], stl:[1.2,2.2], blk:[0.1,0.4], tov:[2.4,3.4], tp:[36,41], ts:[56,60], ob:[3,5.5], db:[-0.5,1.5], age:[24,32], sal:[18,34] },
  { k: "Two-Way Wing",  pos: ["F","G"], w: 9,  mpg:[28,34], pts:[10,16], reb:[3,6],  ast:[1.5,3.5], stl:[1,1.8], blk:[0.4,1.2], tp:[37,42], ts:[57,62], ob:[0.5,2.5], db:[1.5,3.5], age:[23,30], sal:[10,24] },
  { k: "Stretch Big",   pos: ["F","C"], w: 7,  mpg:[26,32], pts:[12,18], reb:[6,9],  ast:[1.5,3], stl:[0.5,1], blk:[0.6,1.4], tp:[36,40], ts:[58,63], ob:[1,3], db:[0.5,2], age:[24,31], sal:[14,28] },
  { k: "Rim Protector", pos: ["C"],     w: 7,  mpg:[26,32], pts:[10,15], reb:[8,12], ast:[1,2.5], stl:[0.5,1], blk:[1.6,3.0], tp:[20,32], ts:[60,66], ob:[-0.5,2], db:[2.5,5], age:[23,31], sal:[16,30] },
  { k: "3&D Role",      pos: ["G","F"], w: 11, mpg:[22,30], pts:[7,12], reb:[2,4],  ast:[1,2.5], stl:[0.8,1.5], blk:[0.2,0.7], tp:[38,43], ts:[57,62], ob:[-0.5,1.5], db:[1,2.8], age:[23,31], sal:[6,15] },
  { k: "Bench Scorer",  pos: ["G","F"], w: 9,  mpg:[18,26], pts:[10,16], reb:[2,4],  ast:[2,4], stl:[0.6,1.2], blk:[0.1,0.5], tp:[33,39], ts:[53,57], ob:[0,2.5], db:[-1.5,0.5], age:[22,30], sal:[5,14] },
  { k: "Rebounding Big",pos: ["C","F"], w: 7,  mpg:[20,28], pts:[8,13], reb:[8,13], ast:[0.8,2], stl:[0.4,0.9], blk:[0.8,1.8], tp:[10,28], ts:[55,62], ob:[-1,1.5], db:[1,3], age:[23,32], sal:[6,16] },
  { k: "Young Upside",  pos: ["G","F","C"], w: 9, mpg:[14,24], pts:[6,13], reb:[2,6], ast:[1,3.5], stl:[0.5,1.2], blk:[0.2,1.0], tp:[28,37], ts:[50,56], ob:[-2,1], db:[-1.5,1.5], age:[19,22], sal:[3,9] },
  { k: "Journeyman",    pos: ["G","F","C"], w: 13, mpg:[10,20], pts:[4,9], reb:[2,5], ast:[1,2.5], stl:[0.4,1], blk:[0.2,0.8], tp:[31,37], ts:[51,56], ob:[-2.5,-0.5], db:[-1,1], age:[26,35], sal:[2,6] },
];

const FIRST = ["Marcus","DeShawn","Tariq","Bodhi","Niko","Ezra","Kai","Anton","Malik","Devonte","Ren","Soren","Cyrus","Jalen","Obi","Luka2","Tre","Kofi","Dario","Mateo","Quentin","Zane","Isaiah","Bron","Amadou","Cole","Vince","Rashad","Theo","Dimitri","Hassan","Felix","Omar","Gavin","Nikola2","Trey","Andre","Lonzo2","Keon","Brock","Yuri","Sasha","Emeka","Dane","Rory","Lucas","Caleb","Pavel","Idris","Beck"];
const LAST = ["Okafor","Beaumont","Vance","Castellanos","Petrov","Holloway","Ndiaye","Whitfield","Sørensen","Marsh","Ferreira","Kowalski","Adeyemi","Brisко","Lindqvist","Reyes","Calloway","Mensah","Dukić","Salazar","Voss","Tanaka","Boateng","Eriksson","Cervantes","Achebe","Larkin","Romano","Volkov","Hadžić","Nuñez","Aoki","Tremblay","Bergström","Diallo","Pappas","Quintana","Mbappé2","Karlsson","Ferro"];

const TEAMS = ["ATX","BAY","CHI","DEN","GLF","HOU","KCY","LDN","MIA","NOR","PHX","SEA","TOR","UTA","VEG"];

function genLeague() {
  const players = [];
  let id = 1;
  // weighted archetype pool
  const pool = [];
  ARCH.forEach((a) => { for (let i = 0; i < a.w; i++) pool.push(a); });
  const total = 78;
  for (let i = 0; i < total; i++) {
    const a = pool[Math.floor(rnd() * pool.length)];
    const pos = a.pos[Math.floor(rnd() * a.pos.length)];
    const ob = +rr(...a.ob).toFixed(1);
    const db = +rr(...a.db).toFixed(1);
    const bpm = +(ob + db).toFixed(1);
    const fn = FIRST[Math.floor(rnd() * FIRST.length)].replace("2", "");
    const ln = LAST[Math.floor(rnd() * LAST.length)].replace("2", "");
    players.push({
      id: id++,
      name: `${fn} ${ln}`,
      arch: a.k,
      pos,
      team: TEAMS[Math.floor(rnd() * TEAMS.length)],
      age: ri(...a.age),
      salary: +rr(...a.sal).toFixed(1),
      mpg: +rr(...a.mpg).toFixed(1),
      pts: +rr(...a.pts).toFixed(1),
      reb: +rr(...a.reb).toFixed(1),
      ast: +rr(...a.ast).toFixed(1),
      stl: +rr(...a.stl).toFixed(1),
      blk: +rr(...a.blk).toFixed(1),
      tov: +rr(...(a.tov || [1.5, 2.5])).toFixed(1),
      tp: +rr(...a.tp).toFixed(1),
      ts: +rr(...a.ts).toFixed(1),
      obpm: ob, dbpm: db, bpm,
      grade: Math.max(31, Math.min(99, Math.round(62 + bpm * 3.4))),
    });
  }
  // de-dup names lightly
  const seen = new Set();
  players.forEach((p) => {
    while (seen.has(p.name)) p.name += ".";
    seen.add(p.name);
  });
  return players.sort((a, b) => b.grade - a.grade);
}

/* ---------- team model ---------- */
const REPLACEMENT_BPM = -2.2;
function evaluateRoster(roster) {
  // assign 240 player-minutes by mpg priority; fill remainder w/ replacement
  const sorted = [...roster].sort((a, b) => b.mpg - a.mpg);
  let remaining = 240;
  let wO = 0, wD = 0, weightedTP = 0, weightedReb = 0, weightedAst = 0, usedMin = 0;
  for (const p of sorted) {
    if (remaining <= 0) break;
    const m = Math.min(p.mpg, remaining);
    remaining -= m;
    wO += p.obpm * m;
    wD += p.dbpm * m;
    weightedTP += p.tp * m;
    weightedReb += p.reb * m;
    weightedAst += p.ast * m;
    usedMin += m;
  }
  // replacement-level fill for empty minutes
  if (remaining > 0) {
    wO += (REPLACEMENT_BPM / 2) * remaining;
    wD += (REPLACEMENT_BPM / 2) * remaining;
  }
  const oRtg = wO / 48;          // net offensive contribution
  const dRtg = wD / 48;          // net defensive contribution
  const net = oRtg + dRtg;
  const wins = Math.max(5, Math.min(73, Math.round(41 + net * 2.7)));
  const spacing = usedMin ? weightedTP / usedMin : 0;
  const reb = usedMin ? weightedReb / usedMin : 0;
  const play = usedMin ? weightedAst / usedMin : 0;
  return { oRtg, dRtg, net, wins, losses: 82 - wins, spacing, reb, play, count: roster.length };
}

function suggestFits(roster, pool, capRoom, onlyAffordable) {
  const base = evaluateRoster(roster);
  const rosterIds = new Set(roster.map((p) => p.id));
  const out = [];
  for (const p of pool) {
    if (rosterIds.has(p.id)) continue;
    if (onlyAffordable && p.salary > capRoom) continue;
    const after = evaluateRoster([...roster, p]);
    const dWins = after.wins - base.wins;
    const helps = p.obpm > p.dbpm ? "Offense" : "Defense";
    out.push({ p, dWins, helps, dNet: after.net - base.net });
  }
  return out.sort((a, b) => b.dWins - a.dWins || b.dNet - a.dNet);
}

/* ---------- small UI atoms ---------- */
function GradePill({ g, size = 34 }) {
  const col = g >= 85 ? C.amber : g >= 72 ? C.cyan : g >= 60 ? C.blue : C.faint;
  return (
    <div style={{
      width: size, height: size, borderRadius: 7, flexShrink: 0,
      display: "grid", placeItems: "center",
      background: "#0C0F14", border: `1.5px solid ${col}`,
      color: col, fontWeight: 800, fontSize: size * 0.42, ...num,
    }}>{g}</div>
  );
}
function PosTag({ pos }) {
  return <span style={{
    fontSize: 10, letterSpacing: 1, fontWeight: 700, color: C.muted,
    border: `1px solid ${C.line}`, borderRadius: 4, padding: "1px 5px",
  }}>{pos}</span>;
}
function Stat({ label, v, accent }) {
  return (
    <div style={{ textAlign: "center", minWidth: 0 }}>
      <div style={{ fontSize: 9, letterSpacing: 1.2, color: C.faint, textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: accent || C.text, ...num }}>{v}</div>
    </div>
  );
}

/* ============================================================ */
export default function HardwoodHQ() {
  const league = useMemo(() => genLeague(), []); // ROSTER_SOURCE: replace with live data here
  const [rosterIds, setRosterIds] = useState(() => league.slice(2, 11).map((p) => p.id));
  const [tab, setTab] = useState("build");
  const [cmp, setCmp] = useState([league[0].id, league[5].id]);
  const [affordableOnly, setAffordableOnly] = useState(true);
  const [poolPos, setPoolPos] = useState("ALL");

  const [cap, setCap] = useState({ cap: 154.6, tax: 187.9, ap1: 195.9, ap2: 207.8 });

  const roster = useMemo(
    () => rosterIds.map((id) => league.find((p) => p.id === id)).filter(Boolean),
    [rosterIds, league]
  );
  const team = useMemo(() => evaluateRoster(roster), [roster]);
  const payroll = useMemo(() => +roster.reduce((s, p) => s + p.salary, 0).toFixed(1), [roster]);
  const capRoom = +(cap.ap1 - payroll).toFixed(1);

  const add = (id) => setRosterIds((r) => (r.includes(id) || r.length >= 15 ? r : [...r, id]));
  const drop = (id) => setRosterIds((r) => r.filter((x) => x !== id));

  const suggestions = useMemo(
    () => suggestFits(roster, league, capRoom, affordableOnly).slice(0, 8),
    [roster, league, capRoom, affordableOnly]
  );

  const weakness = team.oRtg <= team.dRtg ? "Offense" : "Defense";
  const recordPace = team.net >= 6 ? "Contender" : team.net >= 2 ? "Playoff team" : team.net >= -2 ? "Play-in range" : team.net >= -6 ? "Lottery-bound" : "Rebuilding";

  const TABS = [
    { k: "build", label: "Team Builder", icon: Users },
    { k: "pool", label: "Player Pool", icon: BarChart3 },
    { k: "compare", label: "Compare", icon: GitCompare },
    { k: "cap", label: "Salary Cap", icon: DollarSign },
    { k: "fits", label: "Best Fits", icon: Lightbulb },
  ];

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      {/* ---- top bar ---- */}
      <div style={{ borderBottom: `1px solid ${C.line}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: `radial-gradient(circle at 32% 30%, ${C.amber}, ${C.amberDim})`, position: "relative", boxShadow: `0 0 18px ${C.amberDim}` }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", borderTop: `1.5px solid #0C0F14`, transform: "rotate(20deg)" }} />
          </div>
          <div>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 22, letterSpacing: 1, textTransform: "uppercase" }}>Hardwood HQ</div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: C.faint, textTransform: "uppercase" }}>Front-Office Analytics Terminal</div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: C.faint, letterSpacing: 1, textAlign: "right" }}>
          SAMPLE DATA · {league.length} players<br />swap in live feed at ROSTER_SOURCE
        </div>
      </div>

      {/* ---- HERO: live team readout (signature) ---- */}
      <div style={{ padding: "22px 20px", borderBottom: `1px solid ${C.line}`, background: `linear-gradient(180deg, #0E141C, ${C.bg})` }}>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: C.faint, textTransform: "uppercase", fontWeight: 700 }}>Projected Record</div>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 64, lineHeight: 0.9, letterSpacing: 1, ...num }}>
              {team.wins}<span style={{ color: C.faint }}>–</span>{team.losses}
            </div>
            <div style={{ fontSize: 12, color: C.amber, letterSpacing: 1, fontWeight: 700, textTransform: "uppercase" }}>{recordPace}</div>
          </div>

          {/* net rating meter */}
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, letterSpacing: 1.5, color: C.faint, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
              <span>Net Rating</span>
              <span style={{ color: team.net >= 0 ? C.cyan : C.red, ...num }}>{team.net >= 0 ? "+" : ""}{team.net.toFixed(1)}</span>
            </div>
            <div style={{ position: "relative", height: 16, background: C.panel2, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.line}` }}>
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.faint, zIndex: 2 }} />
              {(() => {
                const pct = Math.max(-12, Math.min(12, team.net)) / 12; // -1..1
                const w = Math.abs(pct) * 50;
                const left = pct >= 0 ? 50 : 50 - w;
                return <div style={{ position: "absolute", top: 0, bottom: 0, left: `${left}%`, width: `${w}%`, background: pct >= 0 ? C.cyan : C.red, opacity: 0.85 }} />;
              })()}
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
              <MeterStat label="Offense" v={team.oRtg} icon={Zap} />
              <MeterStat label="Defense" v={team.dRtg} icon={Shield} />
              <MeterStat label="Spacing" v={team.spacing} suffix="% 3PT" raw icon={Target} />
              <MeterStat label="Roster" v={`${team.count}/15`} raw plain icon={Users} />
            </div>
          </div>
        </div>
        {team.count < 8 && (
          <div style={{ marginTop: 14, fontSize: 12, color: C.gold, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={14} /> Thin rotation — empty minutes are filled by replacement-level players, dragging your projection down.
          </div>
        )}
      </div>

      {/* ---- tabs ---- */}
      <div style={{ display: "flex", gap: 4, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, overflowX: "auto" }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
              padding: "8px 14px", borderRadius: 8, cursor: "pointer",
              background: on ? C.panel2 : "transparent",
              border: `1px solid ${on ? C.amber : "transparent"}`,
              color: on ? C.text : C.muted, fontWeight: 700, fontSize: 13,
            }}>
              <Icon size={15} color={on ? C.amber : C.muted} /> {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: 16, maxWidth: 1080, margin: "0 auto" }}>
        {tab === "build" && <Builder roster={roster} drop={drop} team={team} weakness={weakness} />}
        {tab === "pool" && <Pool league={league} rosterIds={rosterIds} add={add} drop={drop} poolPos={poolPos} setPoolPos={setPoolPos} />}
        {tab === "compare" && <Compare league={league} cmp={cmp} setCmp={setCmp} />}
        {tab === "cap" && <Cap roster={roster} payroll={payroll} cap={cap} setCap={setCap} />}
        {tab === "fits" && <Fits suggestions={suggestions} add={add} affordableOnly={affordableOnly} setAffordableOnly={setAffordableOnly} capRoom={capRoom} weakness={weakness} />}
      </div>

      <div style={{ padding: "20px 16px 40px", maxWidth: 1080, margin: "0 auto", fontSize: 11, color: C.faint, lineHeight: 1.6, borderTop: `1px solid ${C.line}` }}>
        <strong style={{ color: C.muted }}>How the numbers work:</strong> each player carries box-plus-minus-style offensive/defensive impact ratings. Team net rating is the minutes-weighted sum of those ratings; projected wins map from net rating at ~2.7 wins per point. Empty rotation minutes are filled at replacement level. Cap lines default to 2025-26 figures and are fully editable. All player data here is synthetic — point <code style={{ color: C.amber }}>ROSTER_SOURCE</code> at a live feed (nba_api / BALLDONTLIE for stats, Spotrac for contracts) to make it real.
      </div>
    </div>
  );
}

function MeterStat({ label, v, suffix, raw, plain, icon: Icon }) {
  const val = plain ? v : raw ? `${(+v).toFixed(1)}${suffix || ""}` : `${v >= 0 ? "+" : ""}${(+v).toFixed(1)}`;
  const col = plain || raw ? C.text : v >= 0 ? C.cyan : C.red;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, letterSpacing: 1.2, color: C.faint, textTransform: "uppercase", fontWeight: 700 }}>
        <Icon size={11} color={C.faint} /> {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: col, ...num }}>{val}</div>
    </div>
  );
}

/* ---------- BUILD tab ---------- */
function Builder({ roster, drop, team, weakness }) {
  const starters = [...roster].sort((a, b) => b.mpg - a.mpg).slice(0, 5);
  const bench = [...roster].sort((a, b) => b.mpg - a.mpg).slice(5);
  if (!roster.length) return <Empty msg="No players on your roster. Head to Player Pool to draft your team." />;
  return (
    <div>
      <SectionHead title="Your Roster" right={
        <span style={{ fontSize: 12, color: C.muted }}>
          Biggest need: <span style={{ color: weakness === "Offense" ? C.amber : C.blue, fontWeight: 700 }}>{weakness}</span>
        </span>
      } />
      <Sub label="Starters" />
      {starters.map((p) => <RosterRow key={p.id} p={p} drop={drop} />)}
      {bench.length > 0 && <Sub label="Rotation / Bench" />}
      {bench.map((p) => <RosterRow key={p.id} p={p} drop={drop} dim />)}
    </div>
  );
}
function RosterRow({ p, drop, dim }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, marginBottom: 6, opacity: dim ? 0.82 : 1 }}>
      <GradePill g={p.grade} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
          <PosTag pos={p.pos} />
        </div>
        <div style={{ fontSize: 11, color: C.faint }}>{p.arch} · {p.age}y · ${p.salary}M</div>
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        <Stat label="PTS" v={p.pts} />
        <Stat label="REB" v={p.reb} />
        <Stat label="AST" v={p.ast} />
        <Stat label="BPM" v={`${p.bpm >= 0 ? "+" : ""}${p.bpm}`} accent={p.bpm >= 0 ? C.cyan : C.red} />
      </div>
      <button onClick={() => drop(p.id)} title="Remove" style={iconBtn}><X size={15} color={C.muted} /></button>
    </div>
  );
}

/* ---------- POOL tab ---------- */
function Pool({ league, rosterIds, add, drop, poolPos, setPoolPos }) {
  const filtered = poolPos === "ALL" ? league : league.filter((p) => p.pos === poolPos);
  return (
    <div>
      <SectionHead title="Player Pool" right={
        <div style={{ display: "flex", gap: 5 }}>
          {["ALL", "G", "F", "C"].map((x) => (
            <button key={x} onClick={() => setPoolPos(x)} style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: poolPos === x ? C.amber : C.panel2, color: poolPos === x ? "#0C0F14" : C.muted,
              border: `1px solid ${poolPos === x ? C.amber : C.line}`,
            }}>{x}</button>
          ))}
        </div>
      } />
      <div style={{ display: "grid", gap: 6 }}>
        {filtered.map((p) => {
          const on = rosterIds.includes(p.id);
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: C.panel, border: `1px solid ${on ? C.cyanDim : C.line}`, borderRadius: 9 }}>
              <GradePill g={p.grade} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <PosTag pos={p.pos} />
                </div>
                <div style={{ fontSize: 11, color: C.faint }}>{p.arch} · ${p.salary}M · {p.pts} pts / {p.reb} reb / {p.ast} ast</div>
              </div>
              <button onClick={() => (on ? drop(p.id) : add(p.id))} style={{
                ...iconBtn, width: "auto", padding: "6px 11px", display: "flex", alignItems: "center", gap: 5,
                background: on ? "transparent" : C.cyanDim, border: `1px solid ${on ? C.line : C.cyan}`,
                color: on ? C.muted : C.cyan, fontWeight: 700, fontSize: 12,
              }}>
                {on ? <><X size={13} /> Drop</> : <><Plus size={13} /> Add</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- COMPARE tab ---------- */
function Compare({ league, cmp, setCmp }) {
  const a = league.find((p) => p.id === cmp[0]);
  const b = league.find((p) => p.id === cmp[1]);
  const norm = (v, max) => Math.round((v / max) * 100);
  const data = [
    { axis: "Scoring", a: norm(a.pts, 32), b: norm(b.pts, 32) },
    { axis: "Rebound", a: norm(a.reb, 13), b: norm(b.reb, 13) },
    { axis: "Playmk", a: norm(a.ast, 11), b: norm(b.ast, 11) },
    { axis: "Defense", a: norm(a.dbpm + 3, 8), b: norm(b.dbpm + 3, 8) },
    { axis: "Spacing", a: norm(a.tp, 43), b: norm(b.tp, 43) },
    { axis: "Efficiency", a: norm(a.ts, 66), b: norm(b.ts, 66) },
  ];
  return (
    <div>
      <SectionHead title="Head-to-Head" />
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <Picker league={league} value={cmp[0]} onChange={(v) => setCmp([v, cmp[1]])} color={C.amber} />
        <Picker league={league} value={cmp[1]} onChange={(v) => setCmp([cmp[0], v])} color={C.blue} />
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 6px 4px" }}>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke={C.line} />
            <PolarAngleAxis dataKey="axis" tick={{ fill: C.muted, fontSize: 11, fontWeight: 600 }} />
            <Radar name={a.name} dataKey="a" stroke={C.amber} fill={C.amber} fillOpacity={0.32} />
            <Radar name={b.name} dataKey="b" stroke={C.blue} fill={C.blue} fillOpacity={0.28} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <CompareCard p={a} color={C.amber} />
        <CompareCard p={b} color={C.blue} />
      </div>
    </div>
  );
}
function Picker({ league, value, onChange, color }) {
  return (
    <select value={value} onChange={(e) => onChange(+e.target.value)} style={{
      flex: 1, minWidth: 160, padding: "9px 11px", borderRadius: 8, fontSize: 13, fontWeight: 600,
      background: C.panel2, color: C.text, border: `1px solid ${color}`, outline: "none",
    }}>
      {league.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.grade})</option>)}
    </select>
  );
}
function CompareCard({ p, color }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderTop: `2px solid ${color}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{p.name}</div>
      <div style={{ fontSize: 11, color: C.faint, marginBottom: 10 }}>{p.arch} · {p.pos} · {p.age}y · ${p.salary}M</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Stat label="GRD" v={p.grade} accent={color} />
        <Stat label="PTS" v={p.pts} />
        <Stat label="REB" v={p.reb} />
        <Stat label="AST" v={p.ast} />
        <Stat label="TS%" v={p.ts} />
        <Stat label="BPM" v={`${p.bpm >= 0 ? "+" : ""}${p.bpm}`} accent={p.bpm >= 0 ? C.cyan : C.red} />
      </div>
    </div>
  );
}

/* ---------- CAP tab ---------- */
function Cap({ roster, payroll, cap, setCap }) {
  const lines = [
    { k: "cap", label: "Salary Cap", v: cap.cap, col: C.cyan },
    { k: "tax", label: "Luxury Tax", v: cap.tax, col: C.gold },
    { k: "ap1", label: "First Apron", v: cap.ap1, col: C.amber },
    { k: "ap2", label: "Second Apron", v: cap.ap2, col: C.red },
  ];
  const maxScale = Math.max(cap.ap2 * 1.05, payroll * 1.05);
  const status = payroll > cap.ap2 ? "Over the second apron" : payroll > cap.ap1 ? "Over the first apron" : payroll > cap.tax ? "In the luxury tax" : payroll > cap.cap ? "Over the cap" : "Under the cap";
  const statusCol = payroll > cap.ap2 ? C.red : payroll > cap.ap1 ? C.amber : payroll > cap.tax ? C.gold : C.cyan;

  return (
    <div>
      <SectionHead title="Salary Cap" right={<span style={{ color: statusCol, fontWeight: 700, fontSize: 13 }}>{status}</span>} />
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <span style={{ fontSize: 11, letterSpacing: 1.5, color: C.faint, textTransform: "uppercase", fontWeight: 700 }}>Total Payroll</span>
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 34, color: statusCol, ...num }}>${payroll}M</span>
        </div>
        {/* payroll bar with threshold ticks */}
        <div style={{ position: "relative", height: 26, background: C.panel2, borderRadius: 8, border: `1px solid ${C.line}`, overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, (payroll / maxScale) * 100)}%`, background: `linear-gradient(90deg, ${C.cyanDim}, ${statusCol})`, opacity: 0.9 }} />
          {lines.map((l) => (
            <div key={l.k} style={{ position: "absolute", top: 0, bottom: 0, left: `${(l.v / maxScale) * 100}%`, width: 2, background: l.col }} />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
          {lines.map((l) => (
            <div key={l.k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: l.col }} />
              <span style={{ fontSize: 11, color: C.muted }}>{l.label}</span>
              <input type="number" value={l.v} onChange={(e) => setCap({ ...cap, [l.k]: +e.target.value })}
                style={{ width: 64, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 5, color: C.text, fontSize: 12, padding: "2px 6px", ...num }} />
            </div>
          ))}
        </div>
      </div>

      <Sub label="Contracts (sorted by salary)" />
      {[...roster].sort((a, b) => b.salary - a.salary).map((p) => {
        const pctBar = (p.salary / Math.max(...roster.map((x) => x.salary))) * 100;
        return (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, marginBottom: 5 }}>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
            <div style={{ width: 120, height: 7, background: C.panel2, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${pctBar}%`, height: "100%", background: C.amber }} />
            </div>
            <span style={{ width: 58, textAlign: "right", fontWeight: 700, color: C.amber, ...num }}>${p.salary}M</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- FITS tab ---------- */
function Fits({ suggestions, add, affordableOnly, setAffordableOnly, capRoom, weakness }) {
  return (
    <div>
      <SectionHead title="Suggested Additions" right={
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: C.muted, cursor: "pointer" }}>
          <input type="checkbox" checked={affordableOnly} onChange={(e) => setAffordableOnly(e.target.checked)} />
          Fits cap room (${capRoom}M)
        </label>
      } />
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
        Ranked by how many projected wins each player adds to <em>your</em> current roster. Your team's biggest need is <span style={{ color: weakness === "Offense" ? C.amber : C.blue, fontWeight: 700 }}>{weakness}</span>.
      </div>
      {suggestions.length === 0 && <Empty msg="No available players fit those constraints. Try unchecking the cap filter." />}
      {suggestions.map(({ p, dWins, helps }, i) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, marginBottom: 6 }}>
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 18, color: C.faint, width: 22, ...num }}>{i + 1}</span>
          <GradePill g={p.grade} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              <PosTag pos={p.pos} />
            </div>
            <div style={{ fontSize: 11, color: C.faint }}>
              {p.arch} · ${p.salary}M · helps <span style={{ color: helps === "Offense" ? C.amber : C.blue, fontWeight: 700 }}>{helps}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: dWins > 0 ? C.cyan : C.faint, fontWeight: 800, ...num }}>
              <TrendingUp size={15} /> {dWins > 0 ? "+" : ""}{dWins}
            </div>
            <div style={{ fontSize: 9, letterSpacing: 1, color: C.faint, textTransform: "uppercase" }}>proj. wins</div>
          </div>
          <button onClick={() => add(p.id)} style={{ ...iconBtn, width: 34, height: 34, background: C.cyanDim, border: `1px solid ${C.cyan}` }} title="Add to roster">
            <Plus size={16} color={C.cyan} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------- shared bits ---------- */
const iconBtn = { width: 30, height: 30, borderRadius: 7, background: "transparent", border: `1px solid ${C.line}`, display: "grid", placeItems: "center", cursor: "pointer" };
function SectionHead({ title, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 4, height: 18, background: C.amber, borderRadius: 2 }} />
        <h2 style={{ margin: 0, fontFamily: display, fontWeight: 800, fontSize: 22, letterSpacing: 0.5, textTransform: "uppercase" }}>{title}</h2>
      </div>
      {right}
    </div>
  );
}
function Sub({ label }) {
  return <div style={{ fontSize: 10, letterSpacing: 2, color: C.faint, textTransform: "uppercase", fontWeight: 700, margin: "16px 0 8px" }}>{label}</div>;
}
function Empty({ msg }) {
  return <div style={{ padding: 30, textAlign: "center", color: C.muted, background: C.panel, border: `1px dashed ${C.line}`, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
    <ChevronRight size={20} color={C.faint} />{msg}
  </div>;
}
