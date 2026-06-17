import { useState, useEffect, useRef, useCallback } from "react";

// ── Google Sheets 設定 ──
// 実際の値に差し替えてください
const SHEETS_CONFIG = {
  API_KEY: "AIzaSyA1urs7gO8wtKZlBcl0Zj05iMz1bY4f84o",        // GCPで発行したAPIキー
  SPREADSHEET_ID: "1O-1Iah8hlavFXUQQE0-4pnhWnNJpA6YEx7QJMJgTGa8", // SpreadsheetのID
};

const SHEETS_API = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.SPREADSHEET_ID}`;

// ── Sheets読み書きユーティリティ ──
async function sheetsRead(range) {
  const url = `${SHEETS_API}/values/${encodeURIComponent(range)}?key=${SHEETS_CONFIG.API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets read error: ${res.status}`);
  const data = await res.json();
  return data.values || [];
}

async function sheetsWrite(range, values) {
  const url = `${SHEETS_API}/values/${encodeURIComponent(range)}?valueInputOption=RAW&key=${SHEETS_CONFIG.API_KEY}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
  if (!res.ok) throw new Error(`Sheets write error: ${res.status}`);
  return res.json();
}

async function sheetsClear(range) {
  const url = `${SHEETS_API}/values/${encodeURIComponent(range)}:clear?key=${SHEETS_CONFIG.API_KEY}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`Sheets clear error: ${res.status}`);
}

// データをSheetの1行にシリアライズ/デシリアライズ
function serializeRow(obj) {
  return [JSON.stringify(obj)];
}

function deserializeRow(row) {
  try { return JSON.parse(row[0]); } catch { return null; }
}

// Sheetsから全データを読み込む
async function loadFromSheets() {
  const [projectRows, clientRows] = await Promise.all([
    sheetsRead("projects!A:A"),
    sheetsRead("clients!A:A"),
  ]);
  const projects = projectRows.map(deserializeRow).filter(Boolean);
  const clients = clientRows.map(deserializeRow).filter(Boolean);
  return { projects, clients };
}

// Sheetsに全データを書き込む
async function saveToSheets(projects, clients) {
  await Promise.all([
    sheetsClear("projects!A:A"),
    sheetsClear("clients!A:A"),
  ]);
  if (projects.length > 0) {
    await sheetsWrite("projects!A1", projects.map(serializeRow));
  }
  if (clients.length > 0) {
    await sheetsWrite("clients!A1", clients.map(serializeRow));
  }
}

// ── ダークモードカラー ──
const COLORS = {
  primary: "#00B5AD",
  primaryLight: "rgba(0,181,173,0.15)",
  primaryDark: "#008C85",
  text: "#E2E8F0",
  textLight: "#718096",
  border: "#2D3748",
  bg: "#0F1117",
  surface: "#1A1F2E",
  card: "#1E2433",
  white: "#1E2433",
  warning: "#F6AD55",
  success: "#68D391",
  danger: "#FC8181",
  archive: "#4A5568",
};

const STATUS_CONFIG = {
  "進行中": { color: "#00B5AD", bg: "rgba(0,181,173,0.15)" },
  "提案中": { color: "#F6AD55", bg: "rgba(246,173,85,0.15)" },
  "完了": { color: "#68D391", bg: "rgba(104,211,145,0.15)" },
  "保留": { color: "#718096", bg: "rgba(113,128,150,0.15)" },
};

const PROJECTS_INIT = [
  { id: 1, name: "アジア展開パネル拡大PJ", description: "東南アジア・南アジアを含む10カ国でのパネル調査拡大。新規クライアント獲得とサンプル品質向上が目標。", status: "進行中", owner: "Takuya", archived: false },
  { id: 2, name: "AIインタビュー連携PJ", description: "AI面接SaaSとのパネル連携。Freeasy・ZINGYYとの3者統合により新たな調査手法を確立する。", status: "進行中", owner: "Takuya", archived: false },
  { id: 3, name: "住宅・建材インサイトPJ", description: "住宅メーカー向けの多国間消費者インサイト調査。アジア6カ国の内装選好データを提供。", status: "完了", owner: "Semee", archived: false },
];

const CLIENTS_INIT = [
  {
    id: 1, projectId: 1, name: "株式会社サクラ", status: "進行中", owner: "Takuya", phase: "実査フェーズ",
    lastUpdated: "2026-06-14", archived: false,
    summary: "国内消費者パネル調査。10カ国展開に向けてサンプル設計中。",
    mtgs: [
      { date: "2026-06-14", title: "週次定例", attendees: ["Takuya", "Semee", "田中様"], content: "サンプルサイズの再検討。IR改善施策についてアライン。次回までにコスト試算を提出する。", actions: ["コスト試算作成 (Takuya, 6/17)", "サンプル設計書更新 (Semee, 6/18)"] },
      { date: "2026-05-30", title: "キックオフMTG", attendees: ["Takuya", "田中様", "鈴木様"], content: "プロジェクト概要・スケジュール確認。調査対象は20-50代女性。", actions: ["提案書送付 (Takuya, 6/3)", "NDA締結 (6/5)"] },
    ],
    materials: [{ name: "提案書_v2.pptx", date: "2026-06-01", type: "提案" }, { name: "サンプル設計書.xlsx", date: "2026-06-10", type: "設計" }, { name: "NDA_締結済.pdf", date: "2026-06-05", type: "契約" }],
    todos: [{ text: "コスト試算作成", due: "2026-06-17", done: false, owner: "Takuya" }, { text: "サンプル設計書更新", due: "2026-06-18", done: false, owner: "Semee" }, { text: "NDA締結", due: "2026-06-05", done: true, owner: "Takuya" }],
    info: { industry: "製造業", country: "日本", contacts: [{ name: "田中 健一", title: "部長", email: "tanaka@sakura.co.jp" }] },
  },
  {
    id: 2, projectId: 1, name: "Bolt Insight", status: "提案中", owner: "Takuya", phase: "提案フェーズ",
    lastUpdated: "2026-06-12", archived: false,
    summary: "HNWI層のリクルーティング実現可能性についてTong Tong Gohと交渉中。",
    mtgs: [{ date: "2026-06-10", title: "要件ヒアリング", attendees: ["Takuya", "Tong Tong Goh"], content: "HNWI定義の確認。年収3000万円以上、資産1億円以上が条件。", actions: ["実現可能性調査 (Takuya, 6/15)"] }],
    materials: [{ name: "HNWI_feasibility_draft.docx", date: "2026-06-12", type: "調査" }],
    todos: [{ text: "HNWI実現可能性の回答メール送付", due: "2026-06-16", done: false, owner: "Takuya" }],
    info: { industry: "リサーチ", country: "シンガポール", contacts: [{ name: "Tong Tong Goh", title: "Director", email: "tong@boltinsight.com" }] },
  },
  {
    id: 3, projectId: 2, name: "Kantar Japan", status: "進行中", owner: "Takuya", phase: "契約フェーズ",
    lastUpdated: "2026-06-11", archived: false,
    summary: "MSA交渉ほぼ完了。支払い条件60→45日、賠償上限の対称化を合意済み。",
    mtgs: [{ date: "2026-06-08", title: "契約条件最終調整", attendees: ["Takuya", "Kantar法務"], content: "支払い条件・賠償上限について合意。最低手数料の文言を修正中。", actions: ["MSA最終版送付 (Kantar, 6/18)"] }],
    materials: [{ name: "MSA_redlined_v3.docx", date: "2026-06-11", type: "契約" }],
    todos: [{ text: "MSA最終版レビュー", due: "2026-06-20", done: false, owner: "Takuya" }, { text: "支払い条件確認", due: "2026-06-08", done: true, owner: "Takuya" }],
    info: { industry: "リサーチ", country: "日本", contacts: [{ name: "山田 花子", title: "法務部長", email: "yamada@kantar.com" }] },
  },
  {
    id: 4, projectId: 2, name: "ZINGYY", status: "進行中", owner: "Takuya", phase: "技術統合フェーズ",
    lastUpdated: "2026-06-10", archived: false,
    summary: "AI面接連携。Freeasy/Abridge・dataSpring・ZINGYYの3者統合を進行中。",
    mtgs: [{ date: "2026-06-05", title: "技術アライメントMTG", attendees: ["Takuya", "Jamers", "ZINGYY Tech"], content: "7ステップAPIフロー確認。認証方式・Webhook仕様を合意。", actions: ["API仕様書ドラフト (Jamers, 6/12)", "テスト環境準備 (ZINGYY, 6/15)"] }],
    materials: [{ name: "API_flow_diagram_v2.pdf", date: "2026-06-06", type: "技術" }, { name: "3者連携提案書.pptx", date: "2026-05-28", type: "提案" }],
    todos: [{ text: "API仕様書最終確認", due: "2026-06-19", done: false, owner: "Jamers" }, { text: "テスト環境確認", due: "2026-06-18", done: false, owner: "Takuya" }],
    info: { industry: "AI/SaaS", country: "日本", contacts: [{ name: "山本 太郎", title: "CTO", email: "yamamoto@zingyy.com" }] },
  },
  {
    id: 5, projectId: 3, name: "Sumitomo Forestry", status: "完了", owner: "Semee", phase: "納品済み",
    lastUpdated: "2026-05-20", archived: false,
    summary: "6カ国・3000名の木材内装選好調査。全納品完了。",
    mtgs: [{ date: "2026-05-15", title: "納品報告会", attendees: ["Takuya", "Semee", "住友林業様"], content: "全国データ・インサイトレポート納品。ベトナムの高コンバージョン率が特に高評価。", actions: ["請求書送付済み"] }],
    materials: [{ name: "最終報告書_6カ国.pptx", date: "2026-05-18", type: "報告" }, { name: "rawdata_all_countries.xlsx", date: "2026-05-18", type: "データ" }],
    todos: [{ text: "請求書送付", due: "2026-05-20", done: true, owner: "Takuya" }],
    info: { industry: "建設/製造", country: "日本", contacts: [{ name: "佐藤 次郎", title: "調達部長", email: "sato@sumitomo-forestry.co.jp" }] },
  },
];

const TYPE_ICON = { "提案": "📋", "設計": "📐", "契約": "📝", "調査": "🔍", "技術": "⚙️", "報告": "📊", "データ": "📦" };

// ── ユーティリティ ──
function isOverdue(client) {
  return client.nextActionDue && new Date(client.nextActionDue) < new Date() && client.status !== "完了" && !client.archived;
}

function getProjectStats(projectId, clients) {
  const cs = clients.filter(c => c.projectId === projectId && !c.archived);
  return {
    total: cs.length,
    active: cs.filter(c => c.status === "進行中").length,
    proposal: cs.filter(c => c.status === "提案中").length,
    overdue: cs.filter(isOverdue).length,
  };
}

// ── 共通コンポーネント ──
function Badge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["保留"];
  return <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 4, padding: "2px 10px", fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>{status}</span>;
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 12, color: COLORS.textLight }}>{label}</span>
    </div>
  );
}

function Card({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "20px 22px", cursor: onClick ? "pointer" : "default", transition: "border-color 0.15s", ...style }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = COLORS.primary)}
      onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = COLORS.border)}
    >
      {children}
    </div>
  );
}

function Avatar({ name }) {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const palette = ["#00B5AD", "#667EEA", "#F6AD55", "#68D391", "#9F7AEA"];
  return <div style={{ width: 28, height: 28, borderRadius: "50%", background: palette[name.charCodeAt(0) % palette.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials}</div>;
}

function BackButton({ onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 14px", cursor: "pointer", color: COLORS.textLight, fontSize: 13, fontWeight: 500, transition: "color 0.15s, border-color 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.color = COLORS.text; e.currentTarget.style.borderColor = COLORS.textLight; }}
      onMouseLeave={e => { e.currentTarget.style.color = COLORS.textLight; e.currentTarget.style.borderColor = COLORS.border; }}
    >
      <span style={{ fontSize: 16 }}>←</span> 戻る
    </button>
  );
}

function Breadcrumb({ items }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: COLORS.textLight, marginBottom: 20 }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span style={{ color: COLORS.border }}>›</span>}
          {item.onClick
            ? <span onClick={item.onClick} style={{ cursor: "pointer", color: COLORS.primary, fontWeight: 500 }}>{item.label}</span>
            : <span style={{ color: COLORS.text, fontWeight: 600 }}>{item.label}</span>
          }
        </span>
      ))}
    </div>
  );
}

function ArchiveButton({ onArchive, label = "アーカイブ" }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={e => { e.stopPropagation(); onArchive(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: "none", border: `1px solid ${hover ? COLORS.archive : COLORS.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: hover ? COLORS.text : COLORS.textLight, fontSize: 12, transition: "all 0.15s" }}
    >
      📦 {label}
    </button>
  );
}

// ── 画面1: プロジェクト一覧 ──
function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

function ProjectCard({ project, stats, onSelect, onArchive, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project);

  if (editing) {
    return (
      <Card style={{ padding: "20px 24px", border: `1px solid ${COLORS.primary}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>プロジェクト名 *</div>
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} style={inputStyle()} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>オーナー</div>
              <select value={draft.owner} onChange={e => setDraft(d => ({ ...d, owner: e.target.value }))} style={inputStyle()}>
                {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>説明</div>
            <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={2} style={inputStyle({ resize: "vertical" })} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>ステータス</div>
            <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} style={inputStyle({ width: "auto" })}>
              {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setDraft(project); setEditing(false); }} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>キャンセル</button>
            <button onClick={() => { if (draft.name.trim()) { onSave(draft); setEditing(false); } }} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#0F1117", fontSize: 13, fontWeight: 700 }}>保存</button>
          </div>
        </div>
      </Card>
    );
  }

  const width = useWindowWidth();
  const isSmall = width < 600;

  return (
    <Card style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div onClick={onSelect} style={{ flex: 1, cursor: "pointer", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>{project.name}</span>
            <Badge status={project.status} />
          </div>
          <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.6, marginBottom: 12 }}>{project.description}</div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <StatPill label="進行中" value={stats.active} color={COLORS.primary} />
            <StatPill label="提案中" value={stats.proposal} color={COLORS.warning} />
            {stats.overdue > 0 && <StatPill label="期限超過" value={stats.overdue} color={COLORS.danger} />}
            <span style={{ fontSize: 12, color: COLORS.border }}>|</span>
            <span style={{ fontSize: 12, color: COLORS.textLight }}>{stats.total}社</span>
          </div>
        </div>
        {isSmall ? (
          // 小画面: 縦並び
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Avatar name={project.owner} />
              <span onClick={onSelect} style={{ color: COLORS.primary, fontSize: 18, cursor: "pointer" }}>›</span>
            </div>
            <button onClick={() => setEditing(true)} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: COLORS.textLight, fontSize: 12, width: "100%" }}>編集</button>
            <ArchiveButton onArchive={onArchive} />
          </div>
        ) : (
          // 大画面: 横並び（元のレイアウト）
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setEditing(true)} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: COLORS.textLight, fontSize: 12 }}>編集</button>
            <ArchiveButton onArchive={onArchive} />
            <Avatar name={project.owner} />
            <span style={{ fontSize: 13, color: COLORS.textLight }}>{project.owner}</span>
            <span onClick={onSelect} style={{ color: COLORS.primary, fontSize: 18, marginLeft: 2, cursor: "pointer" }}>›</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function ProjectList({ projects, clients, onSelect, onArchiveProject, onRestoreProject, onUpdateProject, onAddProject, showArchive, onToggleArchive }) {
  const [showForm, setShowForm] = useState(false);
  const [newPJ, setNewPJ] = useState({ name: "", description: "", status: "進行中", owner: OWNERS[0] });
  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);
  const totalOverdue = clients.filter(c => !c.archived && isOverdue(c)).length;
  const totalActive = clients.filter(c => !c.archived && c.status === "進行中").length;
  const totalProposal = clients.filter(c => !c.archived && c.status === "提案中").length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "総プロジェクト", value: activeProjects.length, color: COLORS.primary },
          { label: "進行中クライアント", value: totalActive, color: COLORS.primary },
          { label: "提案中", value: totalProposal, color: COLORS.warning },
          { label: "期限超過", value: totalOverdue, color: COLORS.danger },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: "16px 12px" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {activeProjects.map(project => {
          const stats = getProjectStats(project.id, clients);
          return (
            <ProjectCard key={project.id} project={project} stats={stats}
              onSelect={() => onSelect(project)}
              onArchive={() => onArchiveProject(project.id)}
              onSave={updated => onUpdateProject(project.id, updated)}
            />
          );
        })}
      </div>

      {/* プロジェクト追加 */}
      {showForm ? (
        <Card style={{ padding: "20px 24px", border: `1px solid ${COLORS.primary}`, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.primary, marginBottom: 14 }}>プロジェクトを追加</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>プロジェクト名 *</div>
                <input value={newPJ.name} onChange={e => setNewPJ(d => ({ ...d, name: e.target.value }))} placeholder="例: アジア展開PJ" style={inputStyle()} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>オーナー</div>
                <select value={newPJ.owner} onChange={e => setNewPJ(d => ({ ...d, owner: e.target.value }))} style={inputStyle()}>
                  {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>説明</div>
              <textarea value={newPJ.description} onChange={e => setNewPJ(d => ({ ...d, description: e.target.value }))} rows={2} style={inputStyle({ resize: "vertical" })} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>ステータス</div>
              <select value={newPJ.status} onChange={e => setNewPJ(d => ({ ...d, status: e.target.value }))} style={inputStyle({ width: "auto" })}>
                {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowForm(false); setNewPJ({ name: "", description: "", status: "進行中", owner: OWNERS[0] }); }} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>キャンセル</button>
              <button onClick={() => { if (newPJ.name.trim()) { onAddProject(newPJ); setShowForm(false); setNewPJ({ name: "", description: "", status: "進行中", owner: OWNERS[0] }); } }} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#0F1117", fontSize: 13, fontWeight: 700 }}>追加</button>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={() => setShowForm(true)} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "12px", cursor: "pointer", color: COLORS.textLight, fontSize: 13, width: "100%", marginTop: 12 }}>+ プロジェクトを追加</button>
      )}

      {/* アーカイブセクション */}
      {archivedProjects.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <button onClick={onToggleArchive} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <span>{showArchive ? "▼" : "▶"}</span> アーカイブ済み ({archivedProjects.length})
          </button>
          {showArchive && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {archivedProjects.map(p => (
                <Card key={p.id} style={{ padding: "14px 20px", opacity: 0.6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontWeight: 600, color: COLORS.textLight, fontSize: 14 }}>{p.name}</span>
                      <span style={{ fontSize: 12, color: COLORS.archive, marginLeft: 10 }}>アーカイブ済み</span>
                    </div>
                    <button onClick={() => onRestoreProject(p.id)} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: COLORS.textLight, fontSize: 12 }}>
                      復元
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 画面2: プロジェクト詳細 ──
function ProjectDetail({ project, clients, onSelectClient, onBack, onArchiveClient, onRestoreClient, onUpdateClient, onUpdateProject, onAddClient, showArchive, onToggleArchive }) {
  const [showClientForm, setShowClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", status: "進行中", owner: OWNERS[0], phase: "", summary: "", info: { industry: "", country: "", contacts: [] } });
  const activeClients = clients.filter(c => c.projectId === project.id && !c.archived);
  const archivedClients = clients.filter(c => c.projectId === project.id && c.archived);
  const stats = getProjectStats(project.id, clients);
  const width = useWindowWidth();
  const isSmall = width < 600;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <BackButton onClick={onBack} />
        <Breadcrumb items={[{ label: "プロジェクト一覧", onClick: onBack }, { label: project.name }]} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.text }}>{project.name}</h2>
          <Badge status={project.status} />
          <button onClick={() => {
            const name = window.prompt("プロジェクト名", project.name);
            if (name && name.trim()) onUpdateProject(project.id, { name: name.trim() });
          }} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: COLORS.textLight, fontSize: 12, marginLeft: "auto" }}>編集</button>
        </div>
        <div style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 10 }}>PJオーナー: {project.owner}</div>
        <SummaryEdit value={project.description} onSave={v => onUpdateProject(project.id, { description: v })} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "クライアント数", value: stats.total, color: COLORS.primary },
          { label: "進行中", value: stats.active, color: COLORS.primary },
          { label: "提案中", value: stats.proposal, color: COLORS.warning },
          { label: "期限超過", value: stats.overdue, color: COLORS.danger },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: "14px 10px" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textLight, marginBottom: 10, letterSpacing: 0.5 }}>クライアント ({activeClients.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {activeClients.map(client => {
          const na = getNextAction(client.todos);
          const naOverdue = na?.due && new Date(na.due) < new Date();
          return (
            <Card key={client.id} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div onClick={() => onSelectClient(client)} style={{ flex: "0 0 160px", cursor: "pointer" }}>
                  <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{client.name}</div>
                  <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>{client.phase}</div>
                </div>
                <div style={{ flex: "0 0 76px" }}><Badge status={client.status} /></div>
                <div style={{ flex: "0 0 90px", display: "flex", alignItems: "center", gap: 5 }}>
                  <Avatar name={client.owner} />
                  <span style={{ fontSize: 12, color: COLORS.textLight }}>{client.owner}</span>
                </div>
                <div onClick={() => onSelectClient(client)} style={{ flex: 1, minWidth: 100, cursor: "pointer" }}>
                  {na
                    ? <>
                        <div style={{ fontSize: 13, color: COLORS.text }}>{na.text}</div>
                        {na.due && <div style={{ fontSize: 11, marginTop: 2, color: naOverdue ? COLORS.danger : COLORS.textLight }}>期限: {na.due}</div>}
                      </>
                    : <div style={{ fontSize: 12, color: COLORS.textLight }}>—</div>
                  }
                </div>
                <div style={{ display: "flex", flexDirection: isSmall ? "column" : "row", alignItems: isSmall ? "flex-end" : "center", gap: isSmall ? 4 : 0, flexShrink: 0 }}>
                  <span onClick={() => onSelectClient(client)} style={{ color: COLORS.primary, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>›</span>
                  <ArchiveButton onArchive={() => onArchiveClient(client.id)} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {showClientForm ? (
        <Card style={{ padding: "20px 24px", border: `1px solid ${COLORS.primary}`, marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.primary, marginBottom: 14 }}>クライアントを追加</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>クライアント名 *</div>
                <input value={newClient.name} onChange={e => setNewClient(d => ({ ...d, name: e.target.value }))} placeholder="例: 株式会社〇〇" style={inputStyle()} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>担当者（自社）</div>
                <select value={newClient.owner} onChange={e => setNewClient(d => ({ ...d, owner: e.target.value }))} style={inputStyle()}>
                  {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>ステータス</div>
                <select value={newClient.status} onChange={e => setNewClient(d => ({ ...d, status: e.target.value }))} style={inputStyle()}>
                  {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>フェーズ</div>
                <input value={newClient.phase} onChange={e => setNewClient(d => ({ ...d, phase: e.target.value }))} placeholder="例: 提案フェーズ" style={inputStyle()} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>業界</div>
                <input value={newClient.info.industry} onChange={e => setNewClient(d => ({ ...d, info: { ...d.info, industry: e.target.value } }))} style={inputStyle()} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>国</div>
                <input value={newClient.info.country} onChange={e => setNewClient(d => ({ ...d, info: { ...d.info, country: e.target.value } }))} style={inputStyle()} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>概要</div>
              <textarea value={newClient.summary} onChange={e => setNewClient(d => ({ ...d, summary: e.target.value }))} rows={2} style={inputStyle({ resize: "vertical" })} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowClientForm(false); setNewClient({ name: "", status: "進行中", owner: OWNERS[0], phase: "", summary: "", info: { industry: "", country: "", contacts: [] } }); }} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>キャンセル</button>
              <button onClick={() => { if (newClient.name.trim()) { onAddClient({ ...newClient, projectId: project.id }); setShowClientForm(false); setNewClient({ name: "", status: "進行中", owner: OWNERS[0], phase: "", summary: "", info: { industry: "", country: "", contacts: [] } }); } }} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#0F1117", fontSize: 13, fontWeight: 700 }}>追加</button>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={() => setShowClientForm(true)} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer", color: COLORS.textLight, fontSize: 13, width: "100%", marginTop: 10 }}>+ クライアントを追加</button>
      )}

      {archivedClients.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <button onClick={onToggleArchive} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <span>{showArchive ? "▼" : "▶"}</span> アーカイブ済みクライアント ({archivedClients.length})
          </button>
          {showArchive && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {archivedClients.map(c => (
                <Card key={c.id} style={{ padding: "12px 18px", opacity: 0.5 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, color: COLORS.textLight, fontSize: 14 }}>{c.name}</span>
                    <button onClick={() => onRestoreClient(c.id)} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: COLORS.textLight, fontSize: 12 }}>復元</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const MATERIAL_TYPES = ["提案", "設計", "契約", "調査", "技術", "報告", "データ", "その他"];
const OWNERS = ["Takuya", "Semee", "Jamers", "Jessica", "Naeun", "Ahram"];

function inputStyle(extra = {}) {
  return {
    background: "#0F1117", border: `1px solid ${COLORS.border}`, borderRadius: 6,
    padding: "7px 10px", fontSize: 13, color: COLORS.text, outline: "none", width: "100%",
    boxSizing: "border-box", ...extra,
  };
}

function today() { return new Date().toISOString().slice(0, 10); }

function SummaryEdit({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  if (editing) {
    return (
      <div>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} style={inputStyle({ resize: "vertical" })} />
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
          <button onClick={() => { setDraft(value || ""); setEditing(false); }} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: COLORS.textLight, fontSize: 12 }}>キャンセル</button>
          <button onClick={() => { onSave(draft); setEditing(false); }} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", color: "#0F1117", fontSize: 12, fontWeight: 700 }}>保存</button>
        </div>
      </div>
    );
  }
  return (
    <div onClick={() => { setDraft(value || ""); setEditing(true); }} style={{ padding: "10px 14px", background: COLORS.primaryLight, borderRadius: 6, fontSize: 13, color: value ? COLORS.text : COLORS.textLight, borderLeft: `3px solid ${COLORS.primary}`, cursor: "pointer" }}>
      {value || "クリックして概要を入力..."}
    </div>
  );
}

// 資料カード（表示 + インライン編集）
function MaterialCard({ material, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(material);

  function handleSave() {
    if (!draft.name.trim()) return;
    onSave(draft);
    setEditing(false);
  }
  function handleCancel() {
    setDraft(material);
    setEditing(false);
  }

  if (editing) {
    return (
      <Card style={{ padding: "16px 18px", border: `1px solid ${COLORS.primary}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>ファイル名・タイトル *</div>
            <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} style={inputStyle()} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>種別</div>
              <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} style={inputStyle()}>
                {MATERIAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>日付</div>
              <input type="date" value={draft.date || ""} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} style={inputStyle()} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>URL / Driveリンク</div>
              <input value={draft.url || ""} onChange={e => setDraft(d => ({ ...d, url: e.target.value }))} placeholder="https://..." style={inputStyle()} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>メモ</div>
            <textarea value={draft.memo || ""} onChange={e => setDraft(d => ({ ...d, memo: e.target.value }))} rows={2} style={inputStyle({ resize: "vertical" })} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={handleCancel} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>キャンセル</button>
            <button onClick={handleSave} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#0F1117", fontSize: 13, fontWeight: 700 }}>保存</button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: "14px 18px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 20, marginTop: 2 }}>{TYPE_ICON[material.type] || "📄"}</span>
        <div onClick={() => setEditing(true)} style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{material.name}</div>
            <span style={{ background: COLORS.surface, color: COLORS.textLight, fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{material.type}</span>
            {material.url && <span style={{ fontSize: 11, color: COLORS.primary }}>🔗 リンクあり</span>}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>{material.date}</div>
          {material.memo && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 6, background: COLORS.surface, borderRadius: 4, padding: "5px 8px" }}>{material.memo}</div>}
        </div>
        <button onClick={e => { e.stopPropagation(); if (window.confirm("この資料を削除しますか？")) onDelete(); }} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 16, padding: "0 4px", flexShrink: 0 }} title="削除">🗑</button>
      </div>
    </Card>
  );
}

// TODOカード（表示 + インライン編集）
function TodoCard({ todo, todoIndex, clientTodos, onToggle, onSave, onSetNextAction, onDelete, done, isNextAction }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo);

  function handleSave() {
    if (!draft.text.trim()) return;
    onSave(draft);
    setEditing(false);
  }
  function handleCancel() {
    setDraft(todo);
    setEditing(false);
  }

  const realIndex = clientTodos.indexOf(todo);

  if (editing) {
    return (
      <Card style={{ padding: "14px 16px", border: `1px solid ${COLORS.primary}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>タスク内容 *</div>
            <input value={draft.text} onChange={e => setDraft(d => ({ ...d, text: e.target.value }))} style={inputStyle()} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>担当者</div>
              <select value={draft.owner} onChange={e => setDraft(d => ({ ...d, owner: e.target.value }))} style={inputStyle()}>
                {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>期限</div>
              <input type="date" value={draft.due || ""} onChange={e => setDraft(d => ({ ...d, due: e.target.value }))} style={inputStyle()} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>メモ</div>
            <textarea value={draft.memo || ""} onChange={e => setDraft(d => ({ ...d, memo: e.target.value }))} rows={2} style={inputStyle({ resize: "vertical" })} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={handleCancel} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>キャンセル</button>
            <button onClick={handleSave} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#0F1117", fontSize: 13, fontWeight: 700 }}>保存</button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: "12px 16px", cursor: "default", opacity: done ? 0.5 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* チェックボックスのみ独立クリック */}
        <div onClick={() => onToggle(realIndex)}
          style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: "pointer", marginTop: 2,
            ...(done
              ? { background: COLORS.success, border: `2px solid ${COLORS.success}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0F1117", fontSize: 11 }
              : { border: `2px solid ${COLORS.primary}` })
          }}
        >{done ? "✓" : ""}</div>
        {/* チェックボックス以外クリックで編集 */}
        <div onClick={() => setEditing(true)} style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, color: done ? COLORS.textLight : COLORS.text, textDecoration: done ? "line-through" : "none" }}>{todo.text}</span>
              {isNextAction && !done && (
                <span style={{ fontSize: 10, background: "rgba(0,181,173,0.2)", color: COLORS.primary, borderRadius: 4, padding: "1px 6px", fontWeight: 700, letterSpacing: 0.3 }}>NEXT</span>
              )}
            </div>
            {todo.memo && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4, background: COLORS.surface, borderRadius: 4, padding: "4px 8px" }}>{todo.memo}</div>}
          </div>
          <Avatar name={todo.owner} />
          <span style={{ fontSize: 12, color: !done && todo.due && new Date(todo.due) < new Date() ? COLORS.danger : COLORS.textLight, minWidth: 70, textAlign: "right" }}>{todo.due}</span>
        </div>
        {!done && (
          <button
            onClick={e => { e.stopPropagation(); onSetNextAction(); }}
            title={isNextAction ? "NEXT ACTIONを解除" : "NEXT ACTIONに設定"}
            style={{ background: isNextAction ? "rgba(0,181,173,0.15)" : "none", border: `1px solid ${isNextAction ? COLORS.primary : COLORS.border}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer", color: isNextAction ? COLORS.primary : COLORS.textLight, fontSize: 11, flexShrink: 0 }}
          >⚡</button>
        )}
        <button onClick={e => { e.stopPropagation(); if (window.confirm("このTODOを削除しますか？")) onDelete(); }} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 16, padding: "0 4px", flexShrink: 0 }} title="削除">🗑</button>
      </div>
    </Card>
  );
}

function AddMaterialForm({ onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("提案");
  const [url, setUrl] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(today());

  function handleSubmit() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), type, url: url.trim(), memo: memo.trim(), date });
  }

  return (
    <Card style={{ padding: "18px 20px", border: `1px solid ${COLORS.primary}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.primary, marginBottom: 14 }}>資料を追加</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>ファイル名・タイトル *</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="例: 提案書_v3.pptx" style={inputStyle()} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>種別</div>
            <select value={type} onChange={e => setType(e.target.value)} style={inputStyle()}>
              {MATERIAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>日付</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle()} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>URL / Driveリンク</div>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={inputStyle()} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>メモ</div>
          <textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="補足情報など" rows={2} style={inputStyle({ resize: "vertical" })} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button onClick={onCancel} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>キャンセル</button>
          <button onClick={handleSubmit} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", color: "#0F1117", fontSize: 13, fontWeight: 700 }}>追加</button>
        </div>
      </div>
    </Card>
  );
}

function AddTodoForm({ onAdd, onCancel }) {
  const [text, setText] = useState("");
  const [owner, setOwner] = useState(OWNERS[0]);
  const [due, setDue] = useState("");
  const [memo, setMemo] = useState("");

  function handleSubmit() {
    if (!text.trim()) return;
    onAdd({ text: text.trim(), owner, due, memo: memo.trim(), done: false });
  }

  return (
    <Card style={{ padding: "18px 20px", border: `1px solid ${COLORS.primary}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.primary, marginBottom: 14 }}>TODOを追加</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>タスク内容 *</div>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="例: 提案書を送付する" style={inputStyle()} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>担当者</div>
            <select value={owner} onChange={e => setOwner(e.target.value)} style={inputStyle()}>
              {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>期限</div>
            <input type="date" value={due} onChange={e => setDue(e.target.value)} style={inputStyle()} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>メモ</div>
          <textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="補足情報など" rows={2} style={inputStyle({ resize: "vertical" })} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button onClick={onCancel} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>キャンセル</button>
          <button onClick={handleSubmit} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", color: "#0F1117", fontSize: 13, fontWeight: 700 }}>追加</button>
        </div>
      </div>
    </Card>
  );
}

// ── MTGコンポーネント群 ──

function MtgForm({ initial, onSave, onCancel, saveLabel = "追加" }) {
  const [date, setDate] = useState(initial?.date || today());
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [attendees, setAttendees] = useState(initial?.attendees || []);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [actions, setActions] = useState(initial?.actions?.length ? initial.actions : [""]);
  const [decisions, setDecisions] = useState(initial?.decisions?.length ? initial.decisions : [""]);
  const [nextAgenda, setNextAgenda] = useState(initial?.nextAgenda?.length ? initial.nextAgenda : [""]);

  function addAttendee() {
    const val = attendeeInput.trim();
    if (val && !attendees.includes(val)) { setAttendees(a => [...a, val]); setAttendeeInput(""); }
  }
  function removeAttendee(i) { setAttendees(a => a.filter((_, idx) => idx !== i)); }
  function handleAttendeeKey(e) { if (e.key === "Enter") { e.preventDefault(); addAttendee(); } }

  function makeListHandlers(setter) {
    return {
      update: (i, val) => setter(a => a.map((v, idx) => idx === i ? val : v)),
      add: () => setter(a => [...a, ""]),
      remove: (i) => setter(a => a.filter((_, idx) => idx !== i)),
    };
  }
  const ah = makeListHandlers(setActions);
  const dh = makeListHandlers(setDecisions);
  const nh = makeListHandlers(setNextAgenda);

  function handleSave() {
    if (!title.trim()) return;
    onSave({
      date, title: title.trim(), content: content.trim(), attendees,
      actions: actions.map(a => a.trim()).filter(Boolean),
      decisions: decisions.map(d => d.trim()).filter(Boolean),
      nextAgenda: nextAgenda.map(n => n.trim()).filter(Boolean),
    });
  }

  function MultiLineInput({ items, handlers, placeholder, addLabel, color = COLORS.primary }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ color, fontSize: 14 }}>•</span>
            <input value={a} onChange={e => handlers.update(i, e.target.value)} placeholder={placeholder} style={inputStyle({ flex: 1 })} />
            <button onClick={() => handlers.remove(i)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 16, padding: "0 4px" }}>✕</button>
          </div>
        ))}
        <button onClick={handlers.add} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 6, padding: "5px", cursor: "pointer", color: COLORS.textLight, fontSize: 12, textAlign: "left" }}>+ {addLabel}</button>
      </div>
    );
  }

  return (
    <Card style={{ padding: "18px 20px", border: `1px solid ${COLORS.primary}` }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>日付</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle()} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>タイトル *</div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="例: 週次定例" style={inputStyle()} />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>参加者</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {attendees.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: COLORS.surface, borderRadius: 20, padding: "3px 10px 3px 6px" }}>
                <Avatar name={a} />
                <span style={{ fontSize: 12, color: COLORS.text }}>{a}</span>
                <span onClick={() => removeAttendee(i)} style={{ fontSize: 11, color: COLORS.textLight, cursor: "pointer", marginLeft: 2 }}>✕</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={attendeeInput} onChange={e => setAttendeeInput(e.target.value)} onKeyDown={handleAttendeeKey} placeholder="名前を入力してEnter" style={inputStyle({ flex: 1 })} />
            <button onClick={addAttendee} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 12px", cursor: "pointer", color: COLORS.textLight, fontSize: 12, flexShrink: 0 }}>追加</button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>内容・議事サマリー</div>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="MTGの内容・議事メモ" rows={4} style={inputStyle({ resize: "vertical" })} />
        </div>

        <div>
          <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 6 }}>決定事項</div>
          <MultiLineInput items={decisions} handlers={dh} placeholder="例: サンプルサイズを500名に確定" addLabel="決定事項を追加" color={COLORS.success} />
        </div>

        <div>
          <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 6 }}>アクションアイテム</div>
          <MultiLineInput items={actions} handlers={ah} placeholder="例: 提案書送付 (Takuya, 6/20)" addLabel="アクションを追加" color={COLORS.primary} />
        </div>

        <div>
          <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 6 }}>次回議題</div>
          <MultiLineInput items={nextAgenda} handlers={nh} placeholder="例: Q3予算の確認" addLabel="次回議題を追加" color={COLORS.warning} />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
          <button onClick={onCancel} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>キャンセル</button>
          <button onClick={handleSave} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "6px 16px", cursor: "pointer", color: "#0F1117", fontSize: 13, fontWeight: 700 }}>{saveLabel}</button>
        </div>
      </div>
    </Card>
  );
}

function MtgCard({ mtg, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <MtgForm initial={mtg} onSave={updated => { onSave(updated); setEditing(false); }} onCancel={() => setEditing(false)} saveLabel="保存" />;
  }

  return (
    <Card style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
        <div onClick={() => setEditing(true)} style={{ flex: 1, cursor: "pointer" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{mtg.title}</span>
          <span style={{ fontSize: 12, color: COLORS.textLight, marginLeft: 10 }}>{mtg.date}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {mtg.attendees.map(a => (
            <div key={a} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Avatar name={a} />
              <span style={{ fontSize: 11, color: COLORS.textLight }}>{a}</span>
            </div>
          ))}
          <button onClick={() => { if (window.confirm("このMTGログを削除しますか？")) onDelete(); }} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 16, padding: "0 4px" }} title="削除">🗑</button>
        </div>
      </div>
      {mtg.content && <div onClick={() => setEditing(true)} style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.7, marginBottom: 12, cursor: "pointer" }}>{mtg.content}</div>}
      {(mtg.decisions?.length > 0 || mtg.actions?.length > 0 || mtg.nextAgenda?.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mtg.decisions?.length > 0 && (
            <div style={{ background: COLORS.surface, borderRadius: 6, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.success, marginBottom: 6, letterSpacing: 0.5 }}>✓ 決定事項</div>
              {mtg.decisions.map((d, j) => (
                <div key={j} style={{ fontSize: 13, color: COLORS.text, display: "flex", gap: 6, marginBottom: 2 }}>
                  <span style={{ color: COLORS.success }}>•</span>{d}
                </div>
              ))}
            </div>
          )}
          {mtg.actions?.length > 0 && (
            <div style={{ background: COLORS.surface, borderRadius: 6, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.primary, marginBottom: 6, letterSpacing: 0.5 }}>⚡ アクションアイテム</div>
              {mtg.actions.map((a, j) => (
                <div key={j} style={{ fontSize: 13, color: COLORS.text, display: "flex", gap: 6, marginBottom: 2 }}>
                  <span style={{ color: COLORS.primary }}>•</span>{a}
                </div>
              ))}
            </div>
          )}
          {mtg.nextAgenda?.length > 0 && (
            <div style={{ background: COLORS.surface, borderRadius: 6, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.warning, marginBottom: 6, letterSpacing: 0.5 }}>📋 次回議題</div>
              {mtg.nextAgenda.map((n, j) => (
                <div key={j} style={{ fontSize: 13, color: COLORS.text, display: "flex", gap: 6, marginBottom: 2 }}>
                  <span style={{ color: COLORS.warning }}>•</span>{n}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function MtgTab({ mtgs, clientId, onAddMtg, onUpdateMtg, onDeleteMtg }) {
  const [showForm, setShowForm] = useState(false);
  const sorted = [...mtgs].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {sorted.map((mtg, i) => (
        <MtgCard key={i} mtg={mtg}
          onSave={updated => onUpdateMtg(clientId, mtgs.indexOf(mtg), updated)}
          onDelete={() => onDeleteMtg(clientId, mtgs.indexOf(mtg))}
        />
      ))}
      {showForm
        ? <MtgForm onSave={mtg => { onAddMtg(clientId, mtg); setShowForm(false); }} onCancel={() => setShowForm(false)} />
        : <button onClick={() => setShowForm(true)} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer", color: COLORS.textLight, fontSize: 13, width: "100%" }}>+ MTGを追加</button>
      }
    </div>
  );
}

function InfoTab({ client, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: client.name, phase: client.phase, status: client.status, owner: client.owner,
    industry: client.info.industry, country: client.info.country,
    contacts: client.info.contacts || [],
  });

  function handleSave() {
    onSave({
      name: draft.name, phase: draft.phase, status: draft.status, owner: draft.owner,
      info: { industry: draft.industry, country: draft.country, contacts: draft.contacts },
    });
    setEditing(false);
  }

  function addContact() {
    setDraft(d => ({ ...d, contacts: [...d.contacts, { name: "", title: "", email: "" }] }));
  }

  function updateContact(i, field, value) {
    setDraft(d => {
      const contacts = d.contacts.map((c, idx) => idx === i ? { ...c, [field]: value } : c);
      return { ...d, contacts };
    });
  }

  function removeContact(i) {
    setDraft(d => ({ ...d, contacts: d.contacts.filter((_, idx) => idx !== i) }));
  }

  if (editing) {
    return (
      <Card style={{ border: `1px solid ${COLORS.primary}`, maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          {[
            { label: "クライアント名", key: "name", type: "text" },
            { label: "フェーズ", key: "phase", type: "text" },
            { label: "ステータス", key: "status", type: "select", options: Object.keys(STATUS_CONFIG) },
            { label: "担当者（自社）", key: "owner", type: "select", options: OWNERS },
            { label: "業界", key: "industry", type: "text" },
            { label: "国", key: "country", type: "text" },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textLight, marginBottom: 4, letterSpacing: 0.5 }}>{f.label}</div>
              {f.type === "select"
                ? <select value={draft[f.key] || ""} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))} style={inputStyle()}>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                : <input value={draft[f.key] || ""} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))} style={inputStyle()} />
              }
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textLight, marginBottom: 8, letterSpacing: 0.5 }}>先方担当者</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {draft.contacts.map((c, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                <input value={c.name} onChange={e => updateContact(i, "name", e.target.value)} placeholder="氏名" style={inputStyle()} />
                <input value={c.title} onChange={e => updateContact(i, "title", e.target.value)} placeholder="役職" style={inputStyle()} />
                <input value={c.email} onChange={e => updateContact(i, "email", e.target.value)} placeholder="メール" style={inputStyle()} />
                <button onClick={() => removeContact(i)} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: COLORS.danger, fontSize: 13 }}>✕</button>
              </div>
            ))}
            <button onClick={addContact} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 6, padding: "6px", cursor: "pointer", color: COLORS.textLight, fontSize: 12, textAlign: "left" }}>+ 担当者を追加</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, paddingTop: 12, borderTop: `1px solid ${COLORS.border}`, position: "sticky", bottom: 0, background: COLORS.card }}>
          <button onClick={() => { setDraft({ name: client.name, phase: client.phase, status: client.status, owner: client.owner, industry: client.info.industry, country: client.info.country, contacts: client.info.contacts || [] }); setEditing(false); }} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>キャンセル</button>
          <button onClick={handleSave} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#0F1117", fontSize: 13, fontWeight: 700 }}>保存</button>
        </div>
      </Card>
    );
  }

  const contacts = client.info.contacts || [];
  return (
    <Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 20 }}>
        {[
          { label: "クライアント名", value: client.name },
          { label: "フェーズ", value: client.phase },
          { label: "ステータス", value: <Badge status={client.status} /> },
          { label: "担当者（自社）", value: client.owner },
          { label: "業界", value: client.info.industry },
          { label: "国", value: client.info.country },
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textLight, marginBottom: 4, letterSpacing: 0.5 }}>{f.label}</div>
            <div style={{ fontSize: 14, color: COLORS.text }}>{f.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textLight, marginBottom: 10, letterSpacing: 0.5 }}>先方担当者</div>
        {contacts.length === 0
          ? <div style={{ fontSize: 13, color: COLORS.textLight }}>未登録</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {contacts.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", background: COLORS.surface, borderRadius: 8, padding: "10px 14px" }}>
                  <Avatar name={c.name || "?"} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{c.name}</div>
                    {c.title && <div style={{ fontSize: 12, color: COLORS.textLight }}>{c.title}</div>}
                  </div>
                  {c.email && <div style={{ fontSize: 12, color: COLORS.primary }}>{c.email}</div>}
                </div>
              ))}
            </div>
        }
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => setEditing(true)} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>編集</button>
      </div>
    </Card>
  );
}

// ── 画面3: クライアント詳細 ──

// NEXT ACTION: TODOから自動計算
function getNextAction(todos) {
  const pending = todos.filter(t => !t.done);
  if (pending.length === 0) return null;
  // isNextActionフラグがあればそれを優先、なければ期限最近のものを返す
  const flagged = pending.find(t => t.isNextAction);
  if (flagged) return flagged;
  const withDue = pending.filter(t => t.due).sort((a, b) => new Date(a.due) - new Date(b.due));
  return withDue[0] || pending[0];
}
function ClientDetail({ client, project, onBackToProject, onBackToTop, onArchive, onToggleTodo, onAddMaterial, onAddTodo, onUpdateMaterial, onUpdateTodo, onSetNextAction, onUpdateClient, onAddMtg, onUpdateMtg, onDeleteMtg, onDeleteMaterial, onDeleteTodo }) {
  const [tab, setTab] = useState("mtg");
  const isDirtyRef = useRef(false);

  function safeSetTab(newTab) {
    if (isDirtyRef.current) {
      if (!window.confirm("編集中の内容が破棄されます。タブを切り替えますか？")) return;
      isDirtyRef.current = false;
    }
    setTab(newTab);
  }
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const tabs = [{ key: "mtg", label: "MTGログ" }, { key: "materials", label: "資料" }, { key: "todos", label: "TODO" }, { key: "info", label: "基本情報" }];
  const pendingTodos = client.todos.filter(t => !t.done);
  const doneTodos = client.todos.filter(t => t.done);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <BackButton onClick={onBackToProject} />
        <Breadcrumb items={[
          { label: "プロジェクト一覧", onClick: onBackToTop },
          { label: project.name, onClick: onBackToProject },
          { label: client.name },
        ]} />
        <div style={{ marginLeft: "auto" }}>
          <ArchiveButton onArchive={onArchive} label="このクライアントをアーカイブ" />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 22, color: COLORS.text, fontWeight: 700 }}>{client.name}</h2>
          <Badge status={client.status} />
        </div>
        <div style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 10 }}>
          {client.phase} ・ 担当: {client.owner} ・ 最終更新: {client.lastUpdated}
        </div>
        <SummaryEdit value={client.summary} onSave={v => onUpdateClient(client.id, { summary: v, lastUpdated: today() })} />
      </div>

      {(() => {
        const na = getNextAction(client.todos);
        if (!na) return null;
        const overdue = na.due && new Date(na.due) < new Date();
        return (
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600, letterSpacing: 0.5 }}>NEXT ACTION</div>
              <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 600 }}>{na.text}</div>
            </div>
            {na.due && (
              <div style={{ marginLeft: "auto", fontSize: 12, color: overdue ? COLORS.danger : COLORS.textLight, fontWeight: 600 }}>{na.due}</div>
            )}
          </div>
        );
      })()}

      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => safeSetTab(t.key)} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 16px", fontSize: 14, fontWeight: 600, color: tab === t.key ? COLORS.primary : COLORS.textLight, borderBottom: tab === t.key ? `2px solid ${COLORS.primary}` : "2px solid transparent", marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "mtg" && (
        <MtgTab mtgs={client.mtgs} clientId={client.id} onAddMtg={onAddMtg} onUpdateMtg={onUpdateMtg} onDeleteMtg={onDeleteMtg} onDirty={v => { isDirtyRef.current = v; }} />
      )}

      {tab === "materials" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {client.materials.map((m, i) => (
            <MaterialCard key={i} material={m} onSave={updated => { onUpdateMaterial(client.id, i, updated); isDirtyRef.current = false; }} onDelete={() => onDeleteMaterial(client.id, i)} onDirty={v => { isDirtyRef.current = v; }} />
          ))}
          {showMaterialForm
            ? <AddMaterialForm onAdd={m => { onAddMaterial(client.id, m); setShowMaterialForm(false); isDirtyRef.current = false; }} onCancel={() => { setShowMaterialForm(false); isDirtyRef.current = false; }} />
            : <button onClick={() => { setShowMaterialForm(true); isDirtyRef.current = true; }} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer", color: COLORS.textLight, fontSize: 13, width: "100%" }}>+ 資料を追加</button>
          }
        </div>
      )}

      {tab === "todos" && (
        <div>
          {pendingTodos.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textLight, marginBottom: 8, letterSpacing: 0.5 }}>未完了</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pendingTodos.map((t, i) => {
                  const realIdx = client.todos.indexOf(t);
                  const na = getNextAction(client.todos);
                  return (
                    <TodoCard key={i} todo={t} clientTodos={client.todos}
                      onToggle={idx => onToggleTodo(client.id, idx)}
                      onSave={updated => onUpdateTodo(client.id, realIdx, updated)}
                      onSetNextAction={() => onSetNextAction(client.id, realIdx)}
                      onDelete={() => onDeleteTodo(client.id, realIdx)}
                      done={false}
                      isNextAction={na && client.todos.indexOf(na) === realIdx}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {doneTodos.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textLight, marginBottom: 8, letterSpacing: 0.5 }}>完了済み</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {doneTodos.map((t, i) => {
                  const realIdx = client.todos.indexOf(t);
                  return (
                    <TodoCard key={i} todo={t} clientTodos={client.todos}
                      onToggle={idx => onToggleTodo(client.id, idx)}
                      onSave={updated => onUpdateTodo(client.id, realIdx, updated)}
                      onSetNextAction={() => {}}
                      onDelete={() => onDeleteTodo(client.id, realIdx)}
                      done={true}
                      isNextAction={false}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {showTodoForm
            ? <AddTodoForm onAdd={t => { onAddTodo(client.id, t); setShowTodoForm(false); }} onCancel={() => setShowTodoForm(false)} />
            : <button onClick={() => setShowTodoForm(true)} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer", color: COLORS.textLight, fontSize: 13, width: "100%" }}>+ TODOを追加</button>
          }
        </div>
      )}

      {tab === "info" && (
        <InfoTab client={client} onSave={updated => onUpdateClient(client.id, updated)} />
      )}
    </div>
  );
}

// ── ルート ──
export default function App() {
  const [projects, setProjects] = useState(PROJECTS_INIT);
  const [clients, setClients] = useState(CLIENTS_INIT);
  const [view, setView] = useState("projects");
  const nextProjectId = useRef(Math.max(...PROJECTS_INIT.map(p => p.id)) + 1);
  const nextClientId = useRef(Math.max(...CLIENTS_INIT.map(c => c.id)) + 1);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showArchive, setShowArchive] = useState(false);

  // Sheets連携状態
  const [syncStatus, setSyncStatus] = useState("idle"); // "idle" | "loading" | "saving" | "saved" | "error"
  const [sheetsEnabled] = useState(SHEETS_CONFIG.API_KEY !== "aaaaaaaaaaaaa");
  const saveTimerRef = useRef(null);
  const isFirstLoad = useRef(true);

  // 起動時にSheetsからデータ読み込み
  useEffect(() => {
    if (!sheetsEnabled) return;
    setSyncStatus("loading");
    loadFromSheets()
      .then(({ projects: p, clients: c }) => {
        if (p.length > 0) {
          setProjects(p);
          nextProjectId.current = Math.max(...p.map(x => x.id)) + 1;
        }
        if (c.length > 0) {
          setClients(c);
          nextClientId.current = Math.max(...c.map(x => x.id)) + 1;
        }
        setSyncStatus("saved");
      })
      .catch(() => setSyncStatus("error"))
      .finally(() => { isFirstLoad.current = false; });
  }, []);

  // データ変更時にdebounce（1秒）して自動保存
  useEffect(() => {
    if (!sheetsEnabled || isFirstLoad.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSyncStatus("saving");
    saveTimerRef.current = setTimeout(() => {
      saveToSheets(projects, clients)
        .then(() => setSyncStatus("saved"))
        .catch(() => setSyncStatus("error"));
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [projects, clients]);

  function goToProject(project) { setSelectedProject(project); setView("project"); setShowArchive(false); }
  function goToClient(client) { setSelectedClient(client); setView("client"); }
  function goToTop() { setSelectedProject(null); setSelectedClient(null); setView("projects"); setShowArchive(false); }
  function goBackToProject() { setSelectedClient(null); setView("project"); }

  function archiveProject(id) {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, archived: true } : p));
    // プロジェクト内のクライアントも一緒にアーカイブ
    setClients(prev => prev.map(c => c.projectId === id ? { ...c, archived: true } : c));
  }

  function restoreProject(id) {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, archived: false } : p));
    // クライアントの復元はユーザーが個別に判断するため自動では行わない
  }

  function archiveClient(id) {
    setClients(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c));
    if (view === "client") goBackToProject();
  }

  function restoreClient(id) {
    setClients(prev => prev.map(c => c.id === id ? { ...c, archived: false } : c));
  }

  function toggleTodo(clientId, todoIndex) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      const newTodos = c.todos.map((t, i) => i === todoIndex ? { ...t, done: !t.done } : t);
      return { ...c, todos: newTodos, lastUpdated: today() };
    }));
  }

  function addMaterial(clientId, material) {
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, materials: [...c.materials, material], lastUpdated: today() } : c
    ));
  }

  function addTodo(clientId, todo) {
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, todos: [...c.todos, todo], lastUpdated: today() } : c
    ));
  }

  function updateMaterial(clientId, index, updated) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      const newMaterials = c.materials.map((m, i) => i === index ? updated : m);
      return { ...c, materials: newMaterials, lastUpdated: today() };
    }));
  }

  function updateTodo(clientId, index, updated) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      const newTodos = c.todos.map((t, i) => i === index ? updated : t);
      return { ...c, todos: newTodos, lastUpdated: today() };
    }));
  }

  function setNextAction(clientId, todoIndex) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      // 対象がすでにフラグ付きなら解除、そうでなければ他を解除して対象にフラグ
      const alreadyFlagged = c.todos[todoIndex]?.isNextAction;
      const newTodos = c.todos.map((t, i) => ({ ...t, isNextAction: alreadyFlagged ? false : i === todoIndex }));
      return { ...c, todos: newTodos };
    }));
  }

  function updateProject(id, updated) {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
  }

  function updateClient(id, updated) {
    const lastUpdated = today();
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updated, lastUpdated } : c));
  }

  function addMtg(clientId, mtg) {
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, mtgs: [...c.mtgs, mtg], lastUpdated: today() } : c
    ));
  }

  function updateMtg(clientId, index, updated) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      const newMtgs = c.mtgs.map((m, i) => i === index ? updated : m);
      return { ...c, mtgs: newMtgs, lastUpdated: today() };
    }));
  }

  function deleteMtg(clientId, index) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, mtgs: c.mtgs.filter((_, i) => i !== index), lastUpdated: today() };
    }));
  }

  function deleteMaterial(clientId, index) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, materials: c.materials.filter((_, i) => i !== index), lastUpdated: today() };
    }));
  }

  function deleteTodo(clientId, index) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      return { ...c, todos: c.todos.filter((_, i) => i !== index), lastUpdated: today() };
    }));
  }

  function addProject(data) {
    const id = nextProjectId.current++;
    setProjects(prev => [...prev, { id, archived: false, ...data }]);
  }

  function addClient(data) {
    const id = nextClientId.current++;
    setClients(prev => [...prev, {
      id, archived: false, lastUpdated: today(),
      mtgs: [], materials: [], todos: [],
      info: { industry: "", country: "", contacts: [] },
      summary: "",
      ...data,
    }]);
  }

  return (
    <div style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", background: COLORS.bg, minHeight: "100vh", color: COLORS.text }}>
      {/* Nav */}
      <div style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 56, gap: 16, position: "sticky", top: 0, zIndex: 100 }}>
        <div onClick={goToTop} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div style={{ width: 28, height: 28, background: COLORS.primary, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#0F1117", fontSize: 14, fontWeight: 700 }}>P</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>Project Hub</span>
          <span style={{ fontSize: 10, background: COLORS.primaryLight, color: COLORS.primary, padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>dataSpring</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {!sheetsEnabled && (
            <span style={{ fontSize: 11, color: COLORS.warning, background: "rgba(246,173,85,0.1)", padding: "3px 8px", borderRadius: 4 }}>
              ⚠ ローカルモード（Sheets未設定）
            </span>
          )}
          {sheetsEnabled && syncStatus === "loading" && (
            <span style={{ fontSize: 11, color: COLORS.textLight }}>⟳ 読み込み中...</span>
          )}
          {sheetsEnabled && syncStatus === "saving" && (
            <span style={{ fontSize: 11, color: COLORS.textLight }}>⟳ 保存中...</span>
          )}
          {sheetsEnabled && syncStatus === "saved" && (
            <span style={{ fontSize: 11, color: COLORS.success }}>✓ 保存済み</span>
          )}
          {sheetsEnabled && syncStatus === "error" && (
            <span style={{ fontSize: 11, color: COLORS.danger }}>✕ 保存エラー（API設定を確認）</span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        {view === "projects" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.text }}>プロジェクト一覧</h1>
              <div style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4 }}>{projects.filter(p => !p.archived).length}件のプロジェクト</div>
            </div>
            <ProjectList
              projects={projects} clients={clients}
              onSelect={goToProject}
              onArchiveProject={archiveProject}
              onRestoreProject={restoreProject}
              onUpdateProject={updateProject}
              onAddProject={addProject}
              showArchive={showArchive}
              onToggleArchive={() => setShowArchive(v => !v)}
            />
          </>
        )}
        {view === "project" && selectedProject && (
          <ProjectDetail
            project={projects.find(p => p.id === selectedProject.id) || selectedProject}
            clients={clients}
            onSelectClient={goToClient} onBack={goToTop}
            onArchiveClient={archiveClient}
            onRestoreClient={restoreClient}
            onUpdateClient={updateClient}
            onUpdateProject={updateProject}
            onAddClient={addClient}
            showArchive={showArchive}
            onToggleArchive={() => setShowArchive(v => !v)}
          />
        )}
        {view === "client" && selectedClient && selectedProject && (
          <ClientDetail
            client={clients.find(c => c.id === selectedClient.id) || selectedClient}
            project={selectedProject}
            onBackToProject={goBackToProject} onBackToTop={goToTop}
            onArchive={() => archiveClient(selectedClient.id)}
            onToggleTodo={toggleTodo}
            onAddMaterial={addMaterial}
            onAddTodo={addTodo}
            onUpdateMaterial={updateMaterial}
            onUpdateTodo={updateTodo}
            onSetNextAction={setNextAction}
            onUpdateClient={updateClient}
            onAddMtg={addMtg}
            onUpdateMtg={updateMtg}
            onDeleteMtg={deleteMtg}
            onDeleteMaterial={deleteMaterial}
            onDeleteTodo={deleteTodo}
          />
        )}
      </div>
    </div>
  );
}
