import { useState, useEffect, useRef, useCallback } from "react";

// ── GAS設定 ──
// GASデプロイ後に発行されたウェブアプリのURLを設定してください
const GAS_URL = "https://script.google.com/macros/s/AKfycbyGcNV1vOSO6htWKBoIQ-1EdkvKTGheNsD-GkZpHBwsUfZwjbJB4BN8bGMqL2PHUtKJ/exec";
const APP_PASSWORD = "okayamaokayama";
// ── GAS読み書きユーティリティ ──
async function loadFromGAS() {
  const url = `${GAS_URL}?action=load`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Load error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data; // { projects, clients, members }
}

async function uploadFileToGAS(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64Data = e.target.result.split(",")[1];
        const res = await fetch(GAS_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            action: "upload",
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            base64Data,
          }),
        });
        if (!res.ok) throw new Error(`Upload error: ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
}

async function saveToGAS(projects, clients, members) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" }, // GASはapplication/jsonをブロックするためtext/plainを使用
    body: JSON.stringify({ action: "save", projects, clients, members }),
  });
  if (!res.ok) throw new Error(`Save error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
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
  "連絡待ち": { color: "#667EEA", bg: "rgba(102,126,234,0.15)" },
  "失注": { color: "#FC8181", bg: "rgba(252,129,129,0.15)" },
};

const POTENTIAL_STATUS_CONFIG = {
  "未接触": { color: "#718096", bg: "rgba(113,128,150,0.15)" },
  "コンタクト済み": { color: "#667EEA", bg: "rgba(102,126,234,0.15)" },
};

const PRIORITY_CONFIG = {
  "高": { color: "#FC8181" },
  "中": { color: "#F6AD55" },
  "低": { color: "#718096" },
};

const PROJECTS_INIT = [];
const CLIENTS_INIT = [];

const TYPE_ICON = { "提案": "📋", "設計": "📐", "契約": "📝", "調査": "🔍", "技術": "⚙️", "報告": "📊", "データ": "📦" };

// ── ユーティリティ ──
function isOverdue(client) {
  return client.nextActionDue && new Date(client.nextActionDue) < new Date() && client.status !== "完了" && !client.archived;
}

function getProjectStats(projectId, clients) {
  const all = clients.filter(c => c.projectId === projectId && !c.archived);
  const cs = all.filter(c => !c.isPotential && c.status !== "失注");
  return {
    total: cs.length,
    active: cs.filter(c => c.status === "進行中").length,
    proposal: cs.filter(c => c.status === "提案中").length,
    potential: all.filter(c => c.isPotential).length,
    overdue: cs.filter(isOverdue).length,
  };
}

// ── 共通コンポーネント ──
function Badge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: "#718096", bg: "rgba(113,128,150,0.15)" };
  return <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 4, padding: "2px 10px", fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>{status}</span>;
}

function StatusSelector({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cfg = STATUS_CONFIG[status] || { color: "#718096", bg: "rgba(113,128,150,0.15)" };

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <span onClick={() => setOpen(v => !v)} style={{ background: cfg.bg, color: cfg.color, borderRadius: 4, padding: "2px 10px", fontSize: 12, fontWeight: 600, letterSpacing: 0.3, cursor: "pointer", userSelect: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
        {status} <span style={{ fontSize: 10 }}>▼</span>
      </span>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 999, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 120 }}>
          {Object.keys(STATUS_CONFIG).map(s => {
            const c = STATUS_CONFIG[s];
            return (
              <div key={s} onClick={() => { onChange(s); setOpen(false); }} style={{ padding: "6px 10px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: s === status ? COLORS.card : "none" }}
                onMouseEnter={e => e.currentTarget.style.background = COLORS.card}
                onMouseLeave={e => e.currentTarget.style.background = s === status ? COLORS.card : "none"}
              >
                <span style={{ background: c.bg, color: c.color, borderRadius: 4, padding: "1px 8px", fontSize: 12, fontWeight: 600 }}>{s}</span>
                {s === status && <span style={{ color: COLORS.primary, fontSize: 12 }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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

// ── フィルタービュー ──
function FilterView({ filterType, projects, clients, onBack, onSelectClient }) {
  const now = new Date();
  const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const FILTER_CONFIG = {
    active:   { label: "進行中クライアント", color: COLORS.primary },
    proposal: { label: "提案中クライアント", color: COLORS.warning },
    waiting:  { label: "連絡待ちクライアント", color: "#667EEA" },
    overdue:  { label: "期限超過ToDo", color: COLORS.danger },
  };
  const cfg = FILTER_CONFIG[filterType];

  const filteredClients = filterType !== "overdue"
    ? clients.filter(c => !c.archived && !c.isPotential && (
        filterType === "active" ? c.status === "進行中" :
        filterType === "proposal" ? c.status === "提案中" :
        filterType === "waiting" ? c.status === "連絡待ち" : false
      ))
    : [];

  // 期限超過ToDoフィルター
  const overdueTodos = filterType === "overdue"
    ? (() => {
        const items = [];
        clients.filter(c => !c.archived && !c.isPotential).forEach(client => {
          const project = projects.find(p => p.id === client.projectId);
          (client.todos || []).filter(t => !t.done && t.due && new Date(t.due) < now).forEach(todo => {
            items.push({ todo, client, project });
          });
        });
        return items.sort((a, b) => new Date(a.todo.due) - new Date(b.todo.due));
      })()
    : [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <BackButton onClick={onBack} />
        <Breadcrumb items={[
          { label: "プロジェクト一覧", onClick: onBack },
          { label: cfg.label },
        ]} />
      </div>

      {/* クライアント一覧フィルター */}
      {filterType !== "overdue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredClients.length === 0 && (
            <div style={{ fontSize: 14, color: COLORS.textLight, textAlign: "center", padding: 32 }}>該当するクライアントはありません</div>
          )}
          {filteredClients.map(client => {
            const project = projects.find(p => p.id === client.projectId);
            const na = getNextAction(client.todos);
            const naOverdue = na?.due && new Date(na.due) < now;
            return (
              <Card key={client.id} onClick={() => onSelectClient(client)} style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ flex: "0 0 180px" }}>
                    <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 15 }}>{client.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>{project?.name}</div>
                  </div>
                  <Badge status={client.status} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Avatar name={client.owner} />
                    <span style={{ fontSize: 13, color: COLORS.textLight }}>{client.owner}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    {na && <>
                      <div style={{ fontSize: 13, color: COLORS.text }}>{na.text}</div>
                      {na.due && <div style={{ fontSize: 11, marginTop: 2, color: naOverdue ? COLORS.danger : COLORS.textLight }}>期限: {na.due}</div>}
                    </>}
                  </div>
                  <span style={{ color: COLORS.primary, fontSize: 18 }}>›</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 期限超過ToDoフィルター */}
      {filterType === "overdue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {overdueTodos.length === 0 && (
            <div style={{ fontSize: 14, color: COLORS.textLight, textAlign: "center", padding: 32 }}>期限超過のToDoはありません</div>
          )}
          {overdueTodos.map(({ todo, client, project }, i) => {
            const diffDays = Math.ceil((now - new Date(todo.due)) / (1000 * 60 * 60 * 24));
            return (
              <Card key={i} onClick={() => onSelectClient(client)} style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16 }}>🔴</span>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 500 }}>{todo.text}</div>
                    <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>{project?.name} › {client.name}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <Avatar name={todo.owner} />
                    <span style={{ fontSize: 12, color: COLORS.textLight }}>{todo.owner}</span>
                    <span style={{ fontSize: 12, color: COLORS.danger, fontWeight: 600 }}>{diffDays}日超過</span>
                    <span style={{ fontSize: 12, color: COLORS.textLight }}>{todo.due}</span>
                    <span style={{ color: COLORS.primary, fontSize: 18 }}>›</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 11, color: COLORS.textLight }}>クライアント管理</div>
            <button onClick={() => setDraft(d => ({ ...d, hasClients: !d.hasClients }))} style={{ background: draft.hasClients !== false ? COLORS.primaryLight : COLORS.surface, border: `1px solid ${draft.hasClients !== false ? COLORS.primary : COLORS.border}`, borderRadius: 6, padding: "4px 12px", cursor: "pointer", color: draft.hasClients !== false ? COLORS.primary : COLORS.textLight, fontSize: 12, fontWeight: 600 }}>
              {draft.hasClients !== false ? "あり" : "なし"}
            </button>
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
          <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.6, marginBottom: 12, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{project.description}</div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <StatPill label="進行中" value={stats.active} color={COLORS.primary} />
            <StatPill label="提案中" value={stats.proposal} color={COLORS.warning} />
            {stats.potential > 0 && <StatPill label="ポテンシャル" value={stats.potential} color="#667EEA" />}
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

function ProjectList({ projects, clients, onSelect, onArchiveProject, onRestoreProject, onDeleteProject, onUpdateProject, onAddProject, showArchive, onToggleArchive, onFilterClick, onClientClick, onCompleteTodo }) {
  const [showForm, setShowForm] = useState(false);
  const [newPJ, setNewPJ] = useState({ name: "", description: "", status: "進行中", owner: OWNERS[0], hasClients: true });
  const [showDeadlines, setShowDeadlines] = useState(true);
  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);
  const activeRealClients = clients.filter(c => !c.archived && !c.isPotential && c.status !== "失注");
  const totalActive = activeRealClients.filter(c => c.status === "進行中").length;
  const totalProposal = activeRealClients.filter(c => c.status === "提案中").length;
  const totalWaiting = activeRealClients.filter(c => c.status === "連絡待ち").length;
  const totalOverdue = clients.filter(c => !c.archived && isOverdue(c)).length;

  // 期限が1週間以内または過ぎているToDoを全クライアント横断で収集
  const now = new Date();
  const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const urgentTodos = [];
  clients.filter(c => !c.archived && !c.isPotential).forEach(client => {
    const project = projects.find(p => p.id === client.projectId);
    (client.todos || []).filter(t => !t.done && t.due).forEach(todo => {
      const dueDate = new Date(todo.due);
      if (dueDate <= oneWeekLater) {
        urgentTodos.push({ todo, client, project });
      }
    });
  });
  urgentTodos.sort((a, b) => new Date(a.todo.due) - new Date(b.todo.due));

  const overdueTodos = urgentTodos.filter(({ todo }) => new Date(todo.due) < now);
  const soonTodos = urgentTodos.filter(({ todo }) => new Date(todo.due) >= now);

  // 1ヶ月以内のToDo収集
  const oneMonthLater = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);
  const monthTodos = [];
  clients.filter(c => !c.archived && !c.isPotential).forEach(client => {
    const project = projects.find(p => p.id === client.projectId);
    (client.todos || []).filter(t => !t.done && t.due).forEach(todo => {
      const dueDate = new Date(todo.due);
      if (dueDate <= oneMonthLater) {
        monthTodos.push({ todo, client, project });
      }
    });
  });

  // 週ごとにグループ化
  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // 月曜始まり
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatWeekLabel(weekStart) {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const fmt = d => `${d.getMonth() + 1}/${d.getDate()}`;
    return `${fmt(weekStart)} 〜 ${fmt(end)}`;
  }

  const weeksMap = new Map();
  const calStart = getWeekStart(now);
  for (let i = 0; i < 5; i++) {
    const ws = new Date(calStart);
    ws.setDate(ws.getDate() + i * 7);
    weeksMap.set(ws.getTime(), []);
  }
  monthTodos.forEach(item => {
    const ws = getWeekStart(new Date(item.todo.due));
    const key = ws.getTime();
    if (weeksMap.has(key)) {
      weeksMap.get(key).push(item);
    }
  });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "総プロジェクト", value: activeProjects.length, color: COLORS.primary, filter: null },
          { label: "進行中クライアント", value: totalActive, color: COLORS.primary, filter: "active" },
          { label: "提案中", value: totalProposal, color: COLORS.warning, filter: "proposal" },
          { label: "連絡待ち", value: totalWaiting, color: "#667EEA", filter: "waiting" },
        ].map(s => (
          <Card key={s.label} onClick={s.filter ? () => onFilterClick(s.filter) : undefined} style={{ textAlign: "center", padding: "16px 12px", cursor: s.filter ? "pointer" : "default" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>{s.label}</div>
            {s.filter && <div style={{ fontSize: 10, color: COLORS.textLight, marginTop: 4 }}>クリックで詳細 ›</div>}
          </Card>
        ))}
      </div>

      {/* 期限アラート：2列 */}
      {urgentTodos.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => setShowDeadlines(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: 0, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
              {showDeadlines ? "▼" : "▶"} 期限アラート
            </span>
            {overdueTodos.length > 0 && (
              <span style={{ fontSize: 11, background: "rgba(252,129,129,0.15)", color: COLORS.danger, borderRadius: 4, padding: "1px 8px", fontWeight: 600 }}>
                期限超過 {overdueTodos.length}件
              </span>
            )}
            {soonTodos.length > 0 && (
              <span style={{ fontSize: 11, background: "rgba(246,173,85,0.15)", color: COLORS.warning, borderRadius: 4, padding: "1px 8px", fontWeight: 600 }}>
                1週間以内 {soonTodos.length}件
              </span>
            )}
          </button>
          {showDeadlines && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* 左列：期限超過 */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.danger, marginBottom: 8, letterSpacing: 0.5 }}>🔴 期限超過</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {overdueTodos.length === 0
                    ? <div style={{ fontSize: 12, color: COLORS.textLight }}>なし</div>
                    : overdueTodos.map(({ todo, client, project }, i) => {
                      const diffDays = Math.ceil((new Date(todo.due) - now) / (1000 * 60 * 60 * 24));
                      const todoIdx = (client.todos || []).indexOf(todo);
                      return (
                        <div key={i} style={{ background: COLORS.card, border: "1px solid rgba(252,129,129,0.3)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                          <div onClick={() => onCompleteTodo(client.id, todoIdx)} style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${COLORS.primary}`, flexShrink: 0, cursor: "pointer" }} />
                          <div onClick={() => onClientClick(client)} style={{ flex: 1, cursor: "pointer", minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: COLORS.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{todo.text}</div>
                            <div style={{ fontSize: 10, color: COLORS.textLight }}>{project?.name} › {client.name}</div>
                          </div>
                          <span style={{ fontSize: 11, color: COLORS.danger, fontWeight: 600, flexShrink: 0 }}>{Math.abs(diffDays)}日超過</span>
                        </div>
                      );
                    })
                  }
                </div>
              </div>
              {/* 右列：1週間以内 */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.warning, marginBottom: 8, letterSpacing: 0.5 }}>🟡 1週間以内</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {soonTodos.length === 0
                    ? <div style={{ fontSize: 12, color: COLORS.textLight }}>なし</div>
                    : soonTodos.map(({ todo, client, project }, i) => {
                      const diffDays = Math.ceil((new Date(todo.due) - now) / (1000 * 60 * 60 * 24));
                      const todoIdx = (client.todos || []).indexOf(todo);
                      return (
                        <div key={i} style={{ background: COLORS.card, border: "1px solid rgba(246,173,85,0.3)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                          <div onClick={() => onCompleteTodo(client.id, todoIdx)} style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${COLORS.primary}`, flexShrink: 0, cursor: "pointer" }} />
                          <div onClick={() => onClientClick(client)} style={{ flex: 1, cursor: "pointer", minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: COLORS.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{todo.text}</div>
                            <div style={{ fontSize: 10, color: COLORS.textLight }}>{project?.name} › {client.name}</div>
                          </div>
                          <span style={{ fontSize: 11, color: COLORS.warning, fontWeight: 600, flexShrink: 0 }}>{diffDays === 0 ? "今日" : `${diffDays}日後`}</span>
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1ヶ月カレンダー */}
      {monthTodos.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>📅 1ヶ月のスケジュール</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from(weeksMap.entries()).map(([wsTime, items]) => {
              const ws = new Date(wsTime);
              const isCurrentWeek = ws <= now && now < new Date(wsTime + 7 * 24 * 60 * 60 * 1000);
              return (
                <div key={wsTime} style={{ background: COLORS.card, border: `1px solid ${isCurrentWeek ? COLORS.primary : COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "8px 14px", background: isCurrentWeek ? COLORS.primaryLight : COLORS.surface, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isCurrentWeek ? COLORS.primary : COLORS.textLight }}>{formatWeekLabel(ws)}</span>
                    {isCurrentWeek && <span style={{ fontSize: 10, background: COLORS.primary, color: "#0F1117", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>今週</span>}
                    <span style={{ fontSize: 11, color: COLORS.textLight, marginLeft: "auto" }}>{items.length}件</span>
                  </div>
                  {items.length > 0 && (
                    <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
                      {items.sort((a, b) => new Date(a.todo.due) - new Date(b.todo.due)).map(({ todo, client, project }, i) => {
                        const dueDate = new Date(todo.due);
                        const isOD = dueDate < now;
                        const todoIdx = (client.todos || []).indexOf(todo);
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: i < items.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                            <div onClick={() => onCompleteTodo(client.id, todoIdx)} style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${isOD ? COLORS.danger : COLORS.primary}`, flexShrink: 0, cursor: "pointer" }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: isOD ? COLORS.danger : COLORS.textLight, flexShrink: 0, minWidth: 32 }}>
                              {`${dueDate.getMonth() + 1}/${dueDate.getDate()}`}
                            </span>
                            <div onClick={() => onClientClick(client)} style={{ flex: 1, cursor: "pointer", minWidth: 0 }}>
                              <span style={{ fontSize: 12, color: isOD ? COLORS.danger : COLORS.text }}>{todo.text}</span>
                              <span style={{ fontSize: 10, color: COLORS.textLight, marginLeft: 6 }}>{client.name}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                              <Avatar name={todo.owner || "?"} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 11, color: COLORS.textLight }}>クライアント管理</div>
              <button onClick={() => setNewPJ(d => ({ ...d, hasClients: !d.hasClients }))} style={{ background: newPJ.hasClients ? COLORS.primaryLight : COLORS.surface, border: `1px solid ${newPJ.hasClients ? COLORS.primary : COLORS.border}`, borderRadius: 6, padding: "4px 12px", cursor: "pointer", color: newPJ.hasClients ? COLORS.primary : COLORS.textLight, fontSize: 12, fontWeight: 600 }}>
                {newPJ.hasClients ? "あり" : "なし"}
              </button>
              <span style={{ fontSize: 11, color: COLORS.textLight }}>「なし」の場合、MTG・資料・ToDoを直接管理</span>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>ステータス</div>
              <select value={newPJ.status} onChange={e => setNewPJ(d => ({ ...d, status: e.target.value }))} style={inputStyle({ width: "auto" })}>
                {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowForm(false); setNewPJ({ name: "", description: "", status: "進行中", owner: OWNERS[0], hasClients: true }); }} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>キャンセル</button>
              <button onClick={() => { if (newPJ.name.trim()) { onAddProject(newPJ); setShowForm(false); setNewPJ({ name: "", description: "", status: "進行中", owner: OWNERS[0], hasClients: true }); } }} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#0F1117", fontSize: 13, fontWeight: 700 }}>追加</button>
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
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => onRestoreProject(p.id)} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: COLORS.textLight, fontSize: 12 }}>復元</button>
                      <button onClick={() => { if (window.confirm(`「${p.name}」を完全に削除しますか？この操作は取り消せません。`)) onDeleteProject(p.id); }} style={{ background: "none", border: `1px solid ${COLORS.danger}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: COLORS.danger, fontSize: 12 }}>削除</button>
                    </div>
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

function ClientRowCard({ client, onSelect, onSave, onArchive, isSmall }) {
  const na = getNextAction(client.todos);
  const naOverdue = na?.due && new Date(na.due) < new Date();

  return (
    <Card style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div onClick={onSelect} style={{ flex: "0 0 160px", cursor: "pointer" }}>
          <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{client.name}</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>{client.phase}</div>
        </div>
        <div style={{ flex: "0 0 76px" }}><Badge status={client.status} /></div>
        <div style={{ flex: "0 0 90px", display: "flex", alignItems: "center", gap: 5 }}>
          <Avatar name={client.owner} />
          <span style={{ fontSize: 12, color: COLORS.textLight }}>{client.owner}</span>
        </div>
        <div onClick={onSelect} style={{ flex: 1, minWidth: 100, cursor: "pointer" }}>
          {na
            ? <>
                <div style={{ fontSize: 13, color: COLORS.text }}>{na.text}</div>
                {na.due && <div style={{ fontSize: 11, marginTop: 2, color: naOverdue ? COLORS.danger : COLORS.textLight }}>期限: {na.due}</div>}
              </>
            : <div style={{ fontSize: 12, color: COLORS.textLight }}>—</div>
          }
        </div>
        <div style={{ display: "flex", flexDirection: isSmall ? "column" : "row", alignItems: isSmall ? "flex-end" : "center", gap: isSmall ? 4 : 0, flexShrink: 0 }}>
          <span onClick={onSelect} style={{ color: COLORS.primary, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>›</span>
          <ArchiveButton onArchive={onArchive} />
        </div>
      </div>
    </Card>
  );
}

// ── 画面2: プロジェクト詳細 ──
// ── クライアントなしプロジェクトのワークスペース ──
function ProjectWorkspace({ project, onBack, onUpdateProject }) {
  const [tab, setTab] = useState("mtg");
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const isDirtyRef = useRef(false);
  const tabs = [{ key: "mtg", label: "MTGログ" }, { key: "materials", label: "資料" }, { key: "todos", label: "ToDo" }];

  const mtgs = project.mtgs || [];
  const materials = project.materials || [];
  const todos = project.todos || [];
  const pendingTodos = todos.filter(t => !t.done);
  const doneTodos = todos.filter(t => t.done);

  function updateProject(patch) { onUpdateProject(project.id, patch); }

  function addMtg(mtg) { updateProject({ mtgs: [...mtgs, mtg] }); }
  function updateMtg(index, updated) { updateProject({ mtgs: mtgs.map((m, i) => i === index ? updated : m) }); }
  function deleteMtg(index) { updateProject({ mtgs: mtgs.filter((_, i) => i !== index) }); }

  function addMaterial(m) {
    if (Array.isArray(m)) {
      updateProject({ materials: [...materials, ...m] });
    } else {
      updateProject({ materials: [...materials, m] });
    }
  }
  function updateMaterial(index, updated) { updateProject({ materials: materials.map((m, i) => i === index ? updated : m) }); }
  function deleteMaterial(index) { updateProject({ materials: materials.filter((_, i) => i !== index) }); }

  function sortTodos(ts) {
    return [...ts].sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    });
  }
  function addTodo(todo) { updateProject({ todos: sortTodos([...todos, todo]) }); }
  function updateTodo(index, updated) { updateProject({ todos: sortTodos(todos.map((t, i) => i === index ? updated : t)) }); }
  function toggleTodo(index) { updateProject({ todos: todos.map((t, i) => i === index ? { ...t, done: !t.done } : t) }); }
  function deleteTodo(index) { updateProject({ todos: todos.filter((_, i) => i !== index) }); }
  function setNextAction(index) {
    const alreadyFlagged = todos[index]?.isNextAction;
    updateProject({ todos: todos.map((t, i) => ({ ...t, isNextAction: alreadyFlagged ? false : i === index })) });
  }

  function safeSetTab(newTab) {
    if (isDirtyRef.current) {
      if (!window.confirm("編集中の内容が破棄されます。タブを切り替えますか？")) return;
      isDirtyRef.current = false;
    }
    setTab(newTab);
  }

  const na = getNextAction(todos);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <BackButton onClick={onBack} />
        <Breadcrumb items={[{ label: "プロジェクト一覧", onClick: onBack }, { label: project.name }]} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.text }}>{project.name}</h2>
          <Badge status={project.status} />
        </div>
        <div style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 10 }}>PJオーナー: {project.owner}</div>
        <SummaryEdit value={project.description} onSave={v => onUpdateProject(project.id, { description: v })} />
      </div>

      {na && (
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600, letterSpacing: 0.5 }}>NEXT ACTION</div>
            <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 600 }}>{na.text}</div>
          </div>
          {na.due && <div style={{ marginLeft: "auto", fontSize: 12, color: new Date(na.due) < new Date() ? COLORS.danger : COLORS.textLight, fontWeight: 600 }}>{na.due}</div>}
        </div>
      )}

      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => safeSetTab(t.key)} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 16px", fontSize: 14, fontWeight: 600, color: tab === t.key ? COLORS.primary : COLORS.textLight, borderBottom: tab === t.key ? `2px solid ${COLORS.primary}` : "2px solid transparent", marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "mtg" && (
        <MtgTab mtgs={mtgs} clientId={project.id} onAddMtg={(_, mtg) => addMtg(mtg)} onUpdateMtg={(_, i, u) => updateMtg(i, u)} onDeleteMtg={(_, i) => deleteMtg(i)}
          onAddTodoFromAction={text => addTodo({ text, owners: [], owner: "", due: "", memo: "", done: false })}
        />
      )}

      {tab === "materials" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {materials.map((m, i) => (
            <MaterialCard key={i} material={m} onSave={updated => updateMaterial(i, updated)} onDelete={() => deleteMaterial(i)} />
          ))}
          {showMaterialForm
            ? <AddMaterialForm onAdd={ms => { addMaterial(ms); setShowMaterialForm(false); }} onCancel={() => setShowMaterialForm(false)} />
            : <button onClick={() => setShowMaterialForm(true)} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer", color: COLORS.textLight, fontSize: 13, width: "100%" }}>+ 資料を追加</button>
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
                  const realIdx = todos.indexOf(t);
                  return (
                    <TodoCard key={i} todo={t} clientTodos={todos}
                      onToggle={() => toggleTodo(realIdx)}
                      onSave={updated => updateTodo(realIdx, updated)}
                      onSetNextAction={() => setNextAction(realIdx)}
                      onDelete={() => deleteTodo(realIdx)}
                      done={false}
                      isNextAction={na && todos.indexOf(na) === realIdx}
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
                  const realIdx = todos.indexOf(t);
                  return (
                    <TodoCard key={i} todo={t} clientTodos={todos}
                      onToggle={() => toggleTodo(realIdx)}
                      onSave={updated => updateTodo(realIdx, updated)}
                      onSetNextAction={() => {}}
                      onDelete={() => deleteTodo(realIdx)}
                      done={true}
                      isNextAction={false}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {showTodoForm
            ? <AddTodoForm onAdd={t => { addTodo(t); setShowTodoForm(false); }} onCancel={() => setShowTodoForm(false)} />
            : <button onClick={() => setShowTodoForm(true)} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer", color: COLORS.textLight, fontSize: 13, width: "100%" }}>+ ToDoを追加</button>
          }
        </div>
      )}
    </div>
  );
}

function ProjectDetail({ project, clients, onSelectClient, onBack, onArchiveClient, onRestoreClient, onDeleteClient, onUpdateClient, onUpdateProject, onAddClient, onSelectPotential, showArchive, onToggleArchive }) {
  const hasClients = project.hasClients !== false;

  // クライアントなしモードの場合はProjectWorkspaceを表示
  if (!hasClients) {
    return (
      <ProjectWorkspace
        project={project}
        onBack={onBack}
        onUpdateProject={onUpdateProject}
      />
    );
  }
  const [showClientForm, setShowClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", status: "進行中", owner: OWNERS[0], phase: "", summary: "", info: { industry: "", country: "", contacts: [] } });
  const STATUS_ORDER = { "進行中": 0, "提案中": 1, "連絡待ち": 2 };
  const activeClients = clients
    .filter(c => c.projectId === project.id && !c.archived && !c.isPotential && c.status !== "失注")
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
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
          { label: "進行中", value: stats.active, color: COLORS.primary },
          { label: "提案中", value: stats.proposal, color: COLORS.warning },
          { label: "ポテンシャル", value: stats.potential, color: "#667EEA" },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: "14px 10px" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textLight, marginBottom: 10, letterSpacing: 0.5 }}>クライアント ({activeClients.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {activeClients.map(client => (
          <ClientRowCard key={client.id} client={client}
            onSelect={() => onSelectClient(client)}
            onSave={updated => onUpdateClient(client.id, updated)}
            onArchive={() => onArchiveClient(client.id)}
            isSmall={isSmall}
          />
        ))}
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
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>URL</div>
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

            {/* 先方担当者 */}
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 8 }}>先方担当者</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {newClient.info.contacts.map((c, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                    <input value={c.name} onChange={e => setNewClient(d => ({ ...d, info: { ...d.info, contacts: d.info.contacts.map((ct, idx) => idx === i ? { ...ct, name: e.target.value } : ct) } }))} placeholder="氏名" style={inputStyle()} />
                    <input value={c.title} onChange={e => setNewClient(d => ({ ...d, info: { ...d.info, contacts: d.info.contacts.map((ct, idx) => idx === i ? { ...ct, title: e.target.value } : ct) } }))} placeholder="役職" style={inputStyle()} />
                    <input value={c.email} onChange={e => setNewClient(d => ({ ...d, info: { ...d.info, contacts: d.info.contacts.map((ct, idx) => idx === i ? { ...ct, email: e.target.value } : ct) } }))} placeholder="メール" style={inputStyle()} />
                    <button onClick={() => setNewClient(d => ({ ...d, info: { ...d.info, contacts: d.info.contacts.filter((_, idx) => idx !== i) } }))} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: COLORS.danger, fontSize: 13 }}>✕</button>
                  </div>
                ))}
                <button onClick={() => setNewClient(d => ({ ...d, info: { ...d.info, contacts: [...d.info.contacts, { name: "", title: "", email: "" }] } }))} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 6, padding: "6px", cursor: "pointer", color: COLORS.textLight, fontSize: 12, textAlign: "left" }}>+ 担当者を追加</button>
              </div>
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
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => onRestoreClient(c.id)} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: COLORS.textLight, fontSize: 12 }}>復元</button>
                      <button onClick={() => { if (window.confirm(`「${c.name}」を完全に削除しますか？この操作は取り消せません。`)) onDeleteClient(c.id); }} style={{ background: "none", border: `1px solid ${COLORS.danger}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: COLORS.danger, fontSize: 12 }}>削除</button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ポテンシャルクライアント */}
      <PotentialSection
        projectId={project.id}
        potentials={clients.filter(c => c.projectId === project.id && c.isPotential && !c.archived)
          .sort((a, b) => {
            const order = { "高": 0, "中": 1, "低": 2 };
            return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
          })}
        onAdd={data => onAddClient({ ...data, projectId: project.id, isPotential: true })}
        onUpdate={onUpdateClient}
        onPromote={id => onUpdateClient(id, { isPotential: false })}
        onArchive={onArchiveClient}
        onSelect={onSelectPotential}
      />

      {/* 失注クライアント */}
      <LostSection
        clients={clients.filter(c => c.projectId === project.id && c.status === "失注" && !c.archived && !c.isPotential)}
        onSelect={onSelectClient}
      />
    </div>
  );
}

// ── 失注クライアント ──
function LostSection({ clients, onSelect }) {
  const [open, setOpen] = useState(true);
  if (clients.length === 0) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <button onClick={() => setOpen(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: 0, marginBottom: 10 }}>
        <span style={{ fontSize: 13 }}>{open ? "▼" : "▶"}</span>
        <span style={{ fontWeight: 700, color: COLORS.text, fontSize: 13 }}>失注</span>
        <span style={{ fontSize: 12, color: COLORS.textLight }}>({clients.length})</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {clients.map(client => (
            <Card key={client.id} onClick={() => onSelect(client)} style={{ padding: "14px 18px", opacity: 0.75 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{client.name}</span>
                    <Badge status="失注" />
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
                      <Avatar name={client.owner} />
                      <span style={{ fontSize: 12, color: COLORS.textLight }}>{client.owner}</span>
                    </div>
                  </div>
                  {client.summary && (
                    <div style={{ fontSize: 13, color: COLORS.textLight, lineHeight: 1.6 }}>{client.summary}</div>
                  )}
                </div>
                <span style={{ color: COLORS.textLight, fontSize: 18, flexShrink: 0 }}>›</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ポテンシャルクライアント ──
function PotentialBadge({ status }) {
  const cfg = POTENTIAL_STATUS_CONFIG[status] || POTENTIAL_STATUS_CONFIG["未接触"];
  return <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 4, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{status}</span>;
}

function PotentialForm({ initial, onSave, onCancel, saveLabel = "追加" }) {
  const [name, setName] = useState(initial?.name || "");
  const [approachStatus, setApproachStatus] = useState(initial?.approachStatus || "未接触");
  const [priority, setPriority] = useState(initial?.priority || "中");
  const [approachDate, setApproachDate] = useState(initial?.approachDate || "");
  const [owner, setOwner] = useState(initial?.owner || OWNERS[0]);
  const [summary, setSummary] = useState(initial?.summary || "");
  const [country, setCountry] = useState(initial?.info?.country || "");
  const [url, setUrl] = useState(initial?.info?.industry || "");

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), approachStatus, priority, approachDate, owner, summary, isPotential: true, phase: approachStatus, status: "提案中", info: { industry: url, country, contacts: initial?.info?.contacts || [] }, mtgs: initial?.mtgs || [], materials: initial?.materials || [], todos: initial?.todos || [] });
  }

  return (
    <Card style={{ padding: "18px 20px", border: `1px solid ${COLORS.primary}` }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>会社名 *</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="例: 株式会社〇〇" style={inputStyle()} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>担当者</div>
            <select value={owner} onChange={e => setOwner(e.target.value)} style={inputStyle()}>
              {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>アプローチ状況</div>
            <select value={approachStatus} onChange={e => setApproachStatus(e.target.value)} style={inputStyle()}>
              {Object.keys(POTENTIAL_STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>優先度</div>
            <select value={priority} onChange={e => setPriority(e.target.value)} style={inputStyle()}>
              {Object.keys(PRIORITY_CONFIG).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>アプローチ予定日</div>
            <DatePicker value={approachDate} onChange={setApproachDate} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>国</div>
            <input value={country} onChange={e => setCountry(e.target.value)} style={inputStyle()} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>URL</div>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={inputStyle()} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>メモ</div>
          <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2} style={inputStyle({ resize: "vertical" })} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>キャンセル</button>
          <button onClick={handleSave} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#0F1117", fontSize: 13, fontWeight: 700 }}>{saveLabel}</button>
        </div>
      </div>
    </Card>
  );
}

function PotentialSection({ projectId, potentials, onAdd, onUpdate, onPromote, onArchive, onSelect }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => setOpen(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 13, display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
          <span>{open ? "▼" : "▶"}</span>
          <span style={{ fontWeight: 700, color: COLORS.text }}>ポテンシャルクライアント</span>
          <span style={{ fontSize: 12, color: COLORS.textLight }}>({potentials.length})</span>
        </button>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {potentials.map(p => (
            editingId === p.id
              ? <PotentialForm key={p.id} initial={p} saveLabel="保存" onSave={data => { onUpdate(p.id, data); setEditingId(null); }} onCancel={() => setEditingId(null)} />
              : (
                <Card key={p.id} style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div onClick={() => onSelect && onSelect(p)} style={{ flex: "0 0 160px", cursor: onSelect ? "pointer" : "default" }}>
                      <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{p.name}</div>
                      {p.info?.country && <div style={{ fontSize: 12, color: COLORS.textLight }}>{p.info.country}</div>}
                    </div>
                    <PotentialBadge status={p.approachStatus || "未接触"} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: PRIORITY_CONFIG[p.priority]?.color || COLORS.textLight }}>
                      {p.priority || "中"}優先
                    </span>
                    {p.approachDate && <span style={{ fontSize: 12, color: COLORS.textLight }}>予定: {p.approachDate}</span>}
                    <div style={{ flex: 1 }} />
                    <Avatar name={p.owner || "?"} />
                    <button onClick={() => setEditingId(p.id)} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: COLORS.textLight, fontSize: 12 }}>編集</button>
                    <button onClick={() => { if (window.confirm(`「${p.name}」をクライアントに昇格しますか？`)) onPromote(p.id); }} style={{ background: "none", border: `1px solid ${COLORS.primary}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: COLORS.primary, fontSize: 12 }}>クライアントに昇格</button>
                    <button onClick={() => { if (window.confirm(`「${p.name}」をアーカイブしますか？`)) onArchive(p.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 16, padding: "0 4px" }}>🗑</button>
                    {onSelect && <span onClick={() => onSelect(p)} style={{ color: COLORS.primary, fontSize: 18, cursor: "pointer" }}>›</span>}
                  </div>
                  {p.summary && <div style={{ fontSize: 13, color: COLORS.textLight, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${COLORS.border}`, whiteSpace: "pre-wrap" }}>{p.summary}</div>}
                </Card>
              )
          ))}
          {showForm
            ? <PotentialForm onSave={data => { onAdd(data); setShowForm(false); }} onCancel={() => setShowForm(false)} />
            : <button onClick={() => setShowForm(true)} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer", color: COLORS.textLight, fontSize: 13, width: "100%" }}>+ ポテンシャルクライアントを追加</button>
          }
        </div>
      )}
    </div>
  );
}

const MATERIAL_TYPES = ["提案", "設計", "契約", "調査", "技術", "報告", "データ", "その他"];
let OWNERS = ["Takuya"]; // Appのmembersと同期して更新される

function inputStyle(extra = {}) {
  return {
    background: "#0F1117", border: `1px solid ${COLORS.border}`, borderRadius: 6,
    padding: "7px 10px", fontSize: 13, color: COLORS.text, outline: "none", width: "100%",
    boxSizing: "border-box", ...extra,
  };
}

function dateInputStyle(extra = {}) {
  return {
    background: "#0F1117", border: `1px solid ${COLORS.border}`, borderRadius: 6,
    padding: "7px 10px", fontSize: 13, color: COLORS.text, outline: "none", width: "100%",
    boxSizing: "border-box",
    colorScheme: "dark",
    ...extra,
  };
}

// ── カスタム日付ピッカー ──
function DatePicker({ value, onChange, placeholder = "YYYY-MM-DD" }) {
  const [text, setText] = useState(value || "");
  const [showCal, setShowCal] = useState(false);
  const [calYear, setCalYear] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return d.getFullYear();
  });
  const [calMonth, setCalMonth] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return d.getMonth();
  });
  const ref = useRef(null);

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setShowCal(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // 親のvalue変化に追従
  useEffect(() => { setText(value || ""); }, [value]);

  function handleTextChange(e) {
    const v = e.target.value;
    setText(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      onChange(v);
      const d = new Date(v);
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
    } else if (v === "") {
      onChange("");
    }
  }

  function handleDayClick(day) {
    const m = String(calMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    const dateStr = `${calYear}-${m}-${d}`;
    setText(dateStr);
    onChange(dateStr);
    setShowCal(false);
  }

  function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function getFirstDayOfWeek(y, m) { return new Date(y, m, 1).getDay(); }

  const days = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfWeek(calYear, calMonth);
  const selectedDay = value && new Date(value).getFullYear() === calYear && new Date(value).getMonth() === calMonth
    ? new Date(value).getDate() : null;
  const todayDate = new Date();
  const isToday = (d) => todayDate.getFullYear() === calYear && todayDate.getMonth() === calMonth && todayDate.getDate() === d;

  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <input
        value={text}
        onChange={handleTextChange}
        onFocus={() => setShowCal(true)}
        placeholder={placeholder}
        style={inputStyle()}
      />
      {showCal && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 999,
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 10, padding: "12px", width: 240, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {/* ヘッダー */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 16, padding: "0 6px" }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{calYear}年 {MONTHS[calMonth]}</span>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 16, padding: "0 6px" }}>›</button>
          </div>
          {/* 曜日ヘッダー */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
            {WEEKDAYS.map((w, i) => (
              <div key={w} style={{ textAlign: "center", fontSize: 11, color: i === 0 ? "#FC8181" : i === 6 ? "#667EEA" : COLORS.textLight, padding: "2px 0" }}>{w}</div>
            ))}
          </div>
          {/* 日付グリッド */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: days }).map((_, i) => {
              const d = i + 1;
              const isSelected = d === selectedDay;
              const isTod = isToday(d);
              return (
                <button key={d} onClick={() => handleDayClick(d)} style={{
                  background: isSelected ? COLORS.primary : "none",
                  border: isTod && !isSelected ? `1px solid ${COLORS.primary}` : "1px solid transparent",
                  borderRadius: 6, padding: "4px 0", cursor: "pointer", textAlign: "center",
                  fontSize: 12, color: isSelected ? "#0F1117" : COLORS.text,
                  fontWeight: isSelected || isTod ? 700 : 400,
                }}>{d}</button>
              );
            })}
          </div>
          {/* クリアボタン */}
          <div style={{ marginTop: 8, textAlign: "right" }}>
            <button onClick={() => { setText(""); onChange(""); setShowCal(false); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 12 }}>クリア</button>
          </div>
        </div>
      )}
    </div>
  );
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
    <div onClick={() => { setDraft(value || ""); setEditing(true); }} style={{ padding: "10px 14px", background: COLORS.primaryLight, borderRadius: 6, fontSize: 13, color: value ? COLORS.text : COLORS.textLight, borderLeft: `3px solid ${COLORS.primary}`, cursor: "pointer", whiteSpace: "pre-wrap" }}>
      {value || "クリックして概要を入力..."}
    </div>
  );
}

// 資料カード（表示 + インライン編集）
function DraggableMaterialList({ materials, onSave, onDelete, onReorder }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  function handleDragStart(i) { setDragIndex(i); }
  function handleDragOver(e, i) { e.preventDefault(); setDragOverIndex(i); }
  function handleDrop(i) {
    if (dragIndex === null || dragIndex === i) { setDragIndex(null); setDragOverIndex(null); return; }
    const newList = [...materials];
    const [moved] = newList.splice(dragIndex, 1);
    newList.splice(i, 0, moved);
    onReorder(newList);
    setDragIndex(null);
    setDragOverIndex(null);
  }
  function handleDragEnd() { setDragIndex(null); setDragOverIndex(null); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {materials.map((m, i) => (
        <div key={i}
          draggable
          onDragStart={() => handleDragStart(i)}
          onDragOver={e => handleDragOver(e, i)}
          onDrop={() => handleDrop(i)}
          onDragEnd={handleDragEnd}
          style={{ opacity: dragIndex === i ? 0.4 : 1, borderTop: dragOverIndex === i && dragIndex !== i ? `2px solid ${COLORS.primary}` : "2px solid transparent", transition: "border-color 0.1s" }}
        >
          <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
            <div style={{ display: "flex", alignItems: "center", cursor: "grab", color: COLORS.textLight, fontSize: 16, padding: "0 4px", flexShrink: 0 }} title="ドラッグして並び替え">⋮⋮</div>
            <div style={{ flex: 1 }}>
              <MaterialCard material={m} onSave={updated => onSave(i, updated)} onDelete={() => onDelete(i)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

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
              <input value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} placeholder="例: 提案、契約、技術" style={inputStyle()} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>日付</div>
              <DatePicker value={draft.date || ""} onChange={v => setDraft(d => ({ ...d, date: v }))} />
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
            {material.url && (
              <a href={material.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: COLORS.primary, textDecoration: "none" }}>🔗 リンクを開く</a>
            )}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>{material.date}</div>
          {material.memo && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 6, background: COLORS.surface, borderRadius: 4, padding: "5px 8px", whiteSpace: "pre-wrap" }}>{material.memo}</div>}
        </div>
        <button onClick={e => { e.stopPropagation(); if (window.confirm("この資料を削除しますか？")) onDelete(); }} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 16, padding: "0 4px", flexShrink: 0 }} title="削除">🗑</button>
      </div>
    </Card>
  );
}

// ToDoカード（表示 + インライン編集）
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
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>担当者（複数可）</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {OWNERS.map(o => {
                  const owners = draft.owners || (draft.owner ? [draft.owner] : []);
                  const selected = owners.includes(o);
                  return (
                    <button key={o} type="button" onClick={() => {
                      const cur = draft.owners || (draft.owner ? [draft.owner] : []);
                      const next = selected ? cur.filter(x => x !== o) : [...cur, o];
                      setDraft(d => ({ ...d, owners: next, owner: next[0] || "" }));
                    }} style={{ background: selected ? COLORS.primary : COLORS.surface, border: `1px solid ${selected ? COLORS.primary : COLORS.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: selected ? "#0F1117" : COLORS.textLight, fontSize: 12 }}>{o}</button>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>期限</div>
              <DatePicker value={draft.due || ""} onChange={v => setDraft(d => ({ ...d, due: v }))} />
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
            {todo.memo && <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4, background: COLORS.surface, borderRadius: 4, padding: "4px 8px", whiteSpace: "pre-wrap" }}>{todo.memo}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <Avatar name={todo.owner || "?"} />
            <span style={{ fontSize: 12, color: COLORS.textLight }}>{todo.owner}</span>
            {todo.owners && todo.owners.length > 1 && todo.owners.slice(1).map(o => (
              <span key={o} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <Avatar name={o} />
                <span style={{ fontSize: 12, color: COLORS.textLight }}>{o}</span>
              </span>
            ))}
          </div>
          <span style={{ fontSize: 12, color: !done && todo.due && new Date(todo.due) < new Date() ? COLORS.danger : COLORS.textLight, minWidth: 70, textAlign: "right" }}>{todo.due}</span>
        </div>
        {!done && (
          <button
            onClick={e => { e.stopPropagation(); onSetNextAction(); }}
            title={isNextAction ? "NEXT ACTIONを解除" : "NEXT ACTIONに設定"}
            style={{ background: isNextAction ? "rgba(0,181,173,0.15)" : "none", border: `1px solid ${isNextAction ? COLORS.primary : COLORS.border}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer", color: isNextAction ? COLORS.primary : COLORS.textLight, fontSize: 11, flexShrink: 0 }}
          >⚡</button>
        )}
        <button onClick={e => { e.stopPropagation(); if (window.confirm("このToDoを削除しますか？")) onDelete(); }} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 16, padding: "0 4px", flexShrink: 0 }} title="削除">🗑</button>
      </div>
    </Card>
  );
}

function AddMaterialForm({ onAdd, onCancel }) {
  const [files, setFiles] = useState([{ name: "", type: "", url: "", memo: "", date: today(), uploading: false, uploadError: "", done: false }]);
  const [isDragging, setIsDragging] = useState(false);
  const gasReady = GAS_URL !== "aaaaaaaaaa";

  async function handleFile(file, index) {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, name: file.name, uploading: true, uploadError: "", done: false } : f));
    if (!gasReady) {
      setFiles(prev => prev.map((f, i) => i === index ? { ...f, uploading: false, uploadError: "GAS未設定のためアップロードできません" } : f));
      return;
    }
    try {
      const result = await uploadFileToGAS(file);
      setFiles(prev => prev.map((f, i) => i === index ? { ...f, url: result.viewUrl, uploading: false, done: true } : f));
    } catch (err) {
      setFiles(prev => prev.map((f, i) => i === index ? { ...f, uploading: false, uploadError: `失敗: ${err.message}` } : f));
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length === 0) return;
    const newEntries = dropped.map(file => ({ name: file.name, type: "", url: "", memo: "", date: today(), uploading: false, uploadError: "", done: false, _file: file }));
    setFiles(prev => {
      const base = prev.filter(f => f.name);
      const updated = [...base, ...newEntries];
      newEntries.forEach((entry, i) => {
        const idx = base.length + i;
        setTimeout(() => handleFile(entry._file, idx), 0);
      });
      return updated;
    });
  }

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files);
    if (selected.length === 0) return;
    const newEntries = selected.map(file => ({ name: file.name, type: "", url: "", memo: "", date: today(), uploading: false, uploadError: "", done: false }));
    setFiles(prev => {
      const base = prev.filter(f => f.name);
      const updated = [...base, ...newEntries];
      selected.forEach((file, i) => {
        const idx = base.length + i;
        setTimeout(() => handleFile(file, idx), 0);
      });
      return updated;
    });
  }

  function addManual() {
    setFiles(prev => [...prev, { name: "", type: "", url: "", memo: "", date: today(), uploading: false, uploadError: "", done: false }]);
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    const valid = files.filter(f => f.name.trim());
    if (valid.length === 0) return;
    onAdd(valid.map(f => ({ name: f.name.trim(), type: f.type.trim(), url: f.url.trim(), memo: f.memo.trim(), date: f.date })));
  }

  const anyUploading = files.some(f => f.uploading);

  return (
    <Card style={{ padding: "18px 20px", border: `1px solid ${COLORS.primary}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.primary, marginBottom: 14 }}>資料を追加</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* ドラッグ＆ドロップエリア */}
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          style={{ background: isDragging ? "rgba(0,181,173,0.08)" : COLORS.surface, borderRadius: 8, padding: "16px 14px", border: `2px dashed ${isDragging ? COLORS.primary : COLORS.border}`, textAlign: "center", transition: "all 0.15s" }}
        >
          <div style={{ fontSize: 22, marginBottom: 6 }}>📂</div>
          <div style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 8 }}>ここにファイルをドロップ（複数可）</div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: 12, color: COLORS.text }}>
            <span>📎</span><span>ファイルを選択</span>
            <input type="file" multiple onChange={handleFileSelect} style={{ display: "none" }} />
          </label>
        </div>

        {/* ファイル一覧 */}
        {files.map((f, i) => (
          <div key={i} style={{ background: COLORS.surface, borderRadius: 8, padding: "12px 14px", border: `1px solid ${f.uploadError ? COLORS.danger : f.done ? COLORS.success : COLORS.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: f.done ? COLORS.success : f.uploadError ? COLORS.danger : COLORS.textLight }}>
                {f.uploading ? "⟳" : f.done ? "✓" : f.uploadError ? "✕" : "○"}
              </span>
              <span style={{ fontSize: 12, color: COLORS.textLight, flex: 1 }}>{f.name || "（未選択）"}</span>
              <button onClick={() => removeFile(i)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 14 }}>✕</button>
            </div>
            {f.uploadError && <div style={{ fontSize: 11, color: COLORS.danger, marginBottom: 6 }}>{f.uploadError}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 3 }}>ファイル名 *</div>
                <input value={f.name} onChange={e => setFiles(prev => prev.map((v, idx) => idx === i ? { ...v, name: e.target.value } : v))} placeholder="例: 提案書_v1.pptx" style={inputStyle()} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 3 }}>種別</div>
                <input value={f.type} onChange={e => setFiles(prev => prev.map((v, idx) => idx === i ? { ...v, type: e.target.value } : v))} placeholder="例: 提案、契約" style={inputStyle()} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 3 }}>日付</div>
                <DatePicker value={f.date} onChange={v => setFiles(prev => prev.map((vv, idx) => idx === i ? { ...vv, date: v } : vv))} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 3 }}>URL（手動入力も可）</div>
              <input value={f.url} onChange={e => setFiles(prev => prev.map((v, idx) => idx === i ? { ...v, url: e.target.value } : v))} placeholder="https://..." style={inputStyle()} />
            </div>
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 3 }}>メモ</div>
              <input value={f.memo} onChange={e => setFiles(prev => prev.map((v, idx) => idx === i ? { ...v, memo: e.target.value } : v))} placeholder="補足情報など" style={inputStyle()} />
            </div>
          </div>
        ))}

        <button onClick={addManual} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 6, padding: "6px", cursor: "pointer", color: COLORS.textLight, fontSize: 12, textAlign: "left" }}>+ 手動で項目を追加</button>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button onClick={onCancel} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>キャンセル</button>
          <button onClick={handleSubmit} disabled={anyUploading} style={{ background: anyUploading ? COLORS.border : COLORS.primary, border: "none", borderRadius: 6, padding: "6px 16px", cursor: anyUploading ? "not-allowed" : "pointer", color: "#0F1117", fontSize: 13, fontWeight: 700 }}>
            {files.filter(f => f.name.trim()).length}件追加
          </button>
        </div>
      </div>
    </Card>
  );
}

function AddTodoForm({ onAdd, onCancel }) {
  const [text, setText] = useState("");
  const [owners, setOwners] = useState([OWNERS[0]]);
  const [due, setDue] = useState("");
  const [memo, setMemo] = useState("");

  function toggleOwner(o) {
    setOwners(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]);
  }

  function handleSubmit() {
    if (!text.trim()) return;
    onAdd({ text: text.trim(), owners, owner: owners[0] || "", due, memo: memo.trim(), done: false });
  }

  return (
    <Card style={{ padding: "18px 20px", border: `1px solid ${COLORS.primary}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.primary, marginBottom: 14 }}>ToDoを追加</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>タスク内容 *</div>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="例: 提案書を送付する" style={inputStyle()} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>担当者（複数可）</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {OWNERS.map(o => (
                <button key={o} type="button" onClick={() => toggleOwner(o)} style={{ background: owners.includes(o) ? COLORS.primary : COLORS.surface, border: `1px solid ${owners.includes(o) ? COLORS.primary : COLORS.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: owners.includes(o) ? "#0F1117" : COLORS.textLight, fontSize: 12 }}>{o}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 4 }}>期限</div>
            <DatePicker value={due} onChange={setDue} />
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
            <DatePicker value={date} onChange={setDate} />
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

function MtgCard({ mtg, onSave, onDelete, onAddTodo }) {
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
      {mtg.content && <div onClick={() => setEditing(true)} style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.7, marginBottom: 12, cursor: "pointer", whiteSpace: "pre-wrap" }}>{mtg.content}</div>}
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
                <div key={j} style={{ fontSize: 13, color: COLORS.text, display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
                  <span style={{ color: COLORS.primary }}>•</span>
                  <span style={{ flex: 1 }}>{a}</span>
                  {onAddTodo && (
                    <button
                      onClick={e => { e.stopPropagation(); onAddTodo(a); }}
                      title="ToDoに追加"
                      style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "1px 7px", cursor: "pointer", color: COLORS.textLight, fontSize: 11, flexShrink: 0, whiteSpace: "nowrap" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.primary; e.currentTarget.style.color = COLORS.primary; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.textLight; }}
                    >+ ToDo</button>
                  )}
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

function MtgTab({ mtgs, clientId, onAddMtg, onUpdateMtg, onDeleteMtg, onAddTodoFromAction }) {
  const [showForm, setShowForm] = useState(false);
  const sorted = [...mtgs].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {sorted.map((mtg, i) => (
        <MtgCard key={i} mtg={mtg}
          onSave={updated => onUpdateMtg(clientId, mtgs.indexOf(mtg), updated)}
          onDelete={() => onDeleteMtg(clientId, mtgs.indexOf(mtg))}
          onAddTodo={onAddTodoFromAction ? text => onAddTodoFromAction(text) : null}
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
            { label: "URL", key: "industry", type: "text" },
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
          { label: "URL", value: client.info.industry
            ? <a href={client.info.industry.startsWith("http") ? client.info.industry : `https://${client.info.industry}`} target="_blank" rel="noreferrer" style={{ color: COLORS.primary, fontSize: 14, wordBreak: "break-all" }}>{client.info.industry}</a>
            : "—"
          },
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

// NEXT ACTION: ToDoから自動計算
function getNextAction(todos) {
  const pending = todos.filter(t => !t.done);
  if (pending.length === 0) return null;
  // isNextActionフラグがあればそれを優先、なければ期限最近のものを返す
  const flagged = pending.find(t => t.isNextAction);
  if (flagged) return flagged;
  const withDue = pending.filter(t => t.due).sort((a, b) => new Date(a.due) - new Date(b.due));
  return withDue[0] || pending[0];
}
// ── ポテンシャル基本情報タブ ──
function PotentialInfoTab({ client, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: client.name, owner: client.owner, summary: client.summary || "",
    approachStatus: client.approachStatus || "未接触",
    priority: client.priority || "中",
    approachDate: client.approachDate || "",
    industry: client.info?.industry || "",
    country: client.info?.country || "",
    contacts: client.info?.contacts || [],
  });

  function handleSave() {
    const { industry, country, contacts, approachStatus, priority, approachDate, ...rest } = draft;
    onSave({ ...rest, approachStatus, priority, approachDate, info: { industry, country, contacts } });
    setEditing(false);
  }

  if (editing) {
    return (
      <Card style={{ border: `1px solid ${COLORS.primary}`, maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          {[
            { label: "会社名", key: "name", type: "text" },
            { label: "担当者（自社）", key: "owner", type: "select", options: OWNERS },
            { label: "URL", key: "industry", type: "text" },
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
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textLight, marginBottom: 4, letterSpacing: 0.5 }}>アプローチ状況</div>
            <select value={draft.approachStatus} onChange={e => setDraft(d => ({ ...d, approachStatus: e.target.value }))} style={inputStyle()}>
              {Object.keys(POTENTIAL_STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textLight, marginBottom: 4, letterSpacing: 0.5 }}>優先度</div>
            <select value={draft.priority} onChange={e => setDraft(d => ({ ...d, priority: e.target.value }))} style={inputStyle()}>
              {Object.keys(PRIORITY_CONFIG).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textLight, marginBottom: 4, letterSpacing: 0.5 }}>アプローチ予定日</div>
            <DatePicker value={draft.approachDate} onChange={v => setDraft(d => ({ ...d, approachDate: v }))} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textLight, marginBottom: 8, letterSpacing: 0.5 }}>先方担当者</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {draft.contacts.map((c, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                <input value={c.name} onChange={e => setDraft(d => ({ ...d, contacts: d.contacts.map((ct, idx) => idx === i ? { ...ct, name: e.target.value } : ct) }))} placeholder="氏名" style={inputStyle()} />
                <input value={c.title} onChange={e => setDraft(d => ({ ...d, contacts: d.contacts.map((ct, idx) => idx === i ? { ...ct, title: e.target.value } : ct) }))} placeholder="役職" style={inputStyle()} />
                <input value={c.email} onChange={e => setDraft(d => ({ ...d, contacts: d.contacts.map((ct, idx) => idx === i ? { ...ct, email: e.target.value } : ct) }))} placeholder="メール" style={inputStyle()} />
                <button onClick={() => setDraft(d => ({ ...d, contacts: d.contacts.filter((_, idx) => idx !== i) }))} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: COLORS.danger, fontSize: 13 }}>✕</button>
              </div>
            ))}
            <button onClick={() => setDraft(d => ({ ...d, contacts: [...d.contacts, { name: "", title: "", email: "" }] }))} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 6, padding: "6px", cursor: "pointer", color: COLORS.textLight, fontSize: 12, textAlign: "left" }}>+ 担当者を追加</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 12, borderTop: `1px solid ${COLORS.border}`, position: "sticky", bottom: 0, background: COLORS.card }}>
          <button onClick={() => setEditing(false)} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>キャンセル</button>
          <button onClick={handleSave} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "#0F1117", fontSize: 13, fontWeight: 700 }}>保存</button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 16 }}>
        {[
          { label: "会社名", value: client.name },
          { label: "担当者（自社）", value: client.owner },
          { label: "アプローチ状況", value: <PotentialBadge status={client.approachStatus || "未接触"} /> },
          { label: "優先度", value: <span style={{ fontWeight: 700, color: PRIORITY_CONFIG[client.priority]?.color || COLORS.textLight }}>{client.priority || "中"}</span> },
          { label: "アプローチ予定日", value: client.approachDate || "—" },
          { label: "URL", value: client.info?.industry ? <a href={client.info.industry.startsWith("http") ? client.info.industry : `https://${client.info.industry}`} target="_blank" rel="noreferrer" style={{ color: COLORS.primary }}>{client.info.industry}</a> : "—" },
          { label: "国", value: client.info?.country || "—" },
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textLight, marginBottom: 4, letterSpacing: 0.5 }}>{f.label}</div>
            <div style={{ fontSize: 14, color: COLORS.text }}>{f.value}</div>
          </div>
        ))}
      </div>
      {(client.info?.contacts || []).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textLight, marginBottom: 10, letterSpacing: 0.5 }}>先方担当者</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {client.info.contacts.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", background: COLORS.surface, borderRadius: 8, padding: "10px 14px" }}>
                <Avatar name={c.name || "?"} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{c.name}</div>
                  {c.title && <div style={{ fontSize: 12, color: COLORS.textLight }}>{c.title}</div>}
                </div>
                {c.email && <div style={{ fontSize: 12, color: COLORS.primary }}>{c.email}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => setEditing(true)} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: COLORS.textLight, fontSize: 13 }}>編集</button>
      </div>
    </Card>
  );
}

// ── ポテンシャルクライアント詳細 ──
function PotentialDetail({ client, project, onBackToProject, onBackToTop, onToggleTodo, onAddMaterial, onAddTodo, onUpdateMaterial, onUpdateTodo, onSetNextAction, onUpdateClient, onAddMtg, onUpdateMtg, onDeleteMtg, onDeleteMaterial, onDeleteTodo, onPromote, onReorderMaterials }) {
  const [tab, setTab] = useState("mtg");
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const isDirtyRef = useRef(false);
  const tabs = [{ key: "mtg", label: "MTGログ" }, { key: "materials", label: "資料" }, { key: "todos", label: "ToDo" }, { key: "info", label: "基本情報" }];
  const pendingTodos = (client.todos || []).filter(t => !t.done);
  const doneTodos = (client.todos || []).filter(t => t.done);

  function safeSetTab(newTab) {
    if (isDirtyRef.current) {
      if (!window.confirm("編集中の内容が破棄されます。タブを切り替えますか？")) return;
      isDirtyRef.current = false;
    }
    setTab(newTab);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <BackButton onClick={onBackToProject} />
        <Breadcrumb items={[
          { label: "プロジェクト一覧", onClick: onBackToTop },
          { label: project.name, onClick: onBackToProject },
          { label: "ポテンシャル" },
          { label: client.name },
        ]} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => { if (window.confirm(`「${client.name}」をクライアントに昇格しますか？`)) { onPromote(client.id); onBackToProject(); } }} style={{ background: "none", border: `1px solid ${COLORS.primary}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: COLORS.primary, fontSize: 13 }}>クライアントに昇格</button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 22, color: COLORS.text, fontWeight: 700 }}>{client.name}</h2>
          <PotentialBadge status={client.approachStatus || "未接触"} />
          <span style={{ fontSize: 12, fontWeight: 700, color: PRIORITY_CONFIG[client.priority]?.color || COLORS.textLight }}>{client.priority || "中"}優先</span>
        </div>
        <div style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 10 }}>
          担当: {client.owner} ・ 最終更新: {client.lastUpdated}
        </div>
        <SummaryEdit value={client.summary} onSave={v => onUpdateClient(client.id, { summary: v, lastUpdated: today() })} />
      </div>

      {/* NEXT ACTION */}
      {(() => {
        const na = getNextAction(client.todos || []);
        if (!na) return null;
        const overdue = na.due && new Date(na.due) < new Date();
        return (
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 600, letterSpacing: 0.5 }}>NEXT ACTION</div>
              <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 600 }}>{na.text}</div>
            </div>
            {na.due && <div style={{ marginLeft: "auto", fontSize: 12, color: overdue ? COLORS.danger : COLORS.textLight, fontWeight: 600 }}>{na.due}</div>}
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
        <MtgTab mtgs={client.mtgs || []} clientId={client.id} onAddMtg={onAddMtg} onUpdateMtg={onUpdateMtg} onDeleteMtg={onDeleteMtg}
          onAddTodoFromAction={text => onAddTodo(client.id, { text, owners: [], owner: "", due: "", memo: "", done: false })}
        />
      )}

      {tab === "materials" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <DraggableMaterialList
            materials={client.materials || []}
            onSave={(i, updated) => onUpdateMaterial(client.id, i, updated)}
            onDelete={i => onDeleteMaterial(client.id, i)}
            onReorder={newList => onReorderMaterials(client.id, newList)}
          />
          {showMaterialForm
            ? <AddMaterialForm onAdd={ms => { onAddMaterial(client.id, ms); setShowMaterialForm(false); isDirtyRef.current = false; }} onCancel={() => { setShowMaterialForm(false); isDirtyRef.current = false; }} />
            : <button onClick={() => setShowMaterialForm(true)} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer", color: COLORS.textLight, fontSize: 13, width: "100%" }}>+ 資料を追加</button>
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
                  const realIdx = (client.todos || []).indexOf(t);
                  const na = getNextAction(client.todos || []);
                  return (
                    <TodoCard key={i} todo={t} clientTodos={client.todos || []}
                      onToggle={idx => onToggleTodo(client.id, idx)}
                      onSave={updated => onUpdateTodo(client.id, realIdx, updated)}
                      onSetNextAction={() => onSetNextAction(client.id, realIdx)}
                      onDelete={() => onDeleteTodo(client.id, realIdx)}
                      done={false}
                      isNextAction={na && (client.todos || []).indexOf(na) === realIdx}
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
                  const realIdx = (client.todos || []).indexOf(t);
                  return (
                    <TodoCard key={i} todo={t} clientTodos={client.todos || []}
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
            : <button onClick={() => setShowTodoForm(true)} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer", color: COLORS.textLight, fontSize: 13, width: "100%" }}>+ ToDoを追加</button>
          }
        </div>
      )}

      {tab === "info" && (
        <PotentialInfoTab client={client} onSave={updated => onUpdateClient(client.id, updated)} />
      )}
    </div>
  );
}

function ClientDetail({ client, project, onBackToProject, onBackToTop, onArchive, onToggleTodo, onAddMaterial, onAddTodo, onUpdateMaterial, onUpdateTodo, onSetNextAction, onUpdateClient, onAddMtg, onUpdateMtg, onDeleteMtg, onDeleteMaterial, onDeleteTodo, onReorderMaterials }) {
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
  const tabs = [{ key: "mtg", label: "MTGログ" }, { key: "materials", label: "資料" }, { key: "todos", label: "ToDo" }, { key: "info", label: "基本情報" }];
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
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 22, color: COLORS.text, fontWeight: 700 }}>{client.name}</h2>
          <StatusSelector status={client.status} onChange={s => onUpdateClient(client.id, { status: s })} />
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
        <MtgTab mtgs={client.mtgs} clientId={client.id} onAddMtg={onAddMtg} onUpdateMtg={onUpdateMtg} onDeleteMtg={onDeleteMtg}
          onAddTodoFromAction={text => {
            onAddTodo(client.id, { text, owners: [], owner: "", due: "", memo: "", done: false });
          }}
        />
      )}

      {tab === "materials" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <DraggableMaterialList
            materials={client.materials}
            onSave={(i, updated) => { onUpdateMaterial(client.id, i, updated); isDirtyRef.current = false; }}
            onDelete={i => onDeleteMaterial(client.id, i)}
            onReorder={newList => onReorderMaterials(client.id, newList)}
          />
          {showMaterialForm
            ? <AddMaterialForm onAdd={ms => { onAddMaterial(client.id, ms); setShowMaterialForm(false); isDirtyRef.current = false; }} onCancel={() => { setShowMaterialForm(false); isDirtyRef.current = false; }} />
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
            : <button onClick={() => setShowTodoForm(true)} style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer", color: COLORS.textLight, fontSize: 13, width: "100%" }}>+ ToDoを追加</button>
          }
        </div>
      )}

      {tab === "info" && (
        <InfoTab client={client} onSave={updated => onUpdateClient(client.id, updated)} />
      )}
    </div>
  );
}

// ── メンバー管理 ──
function MemberManager({ members, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addMember() {
    const n = newName.trim();
    if (!n || members.includes(n)) return;
    onUpdate([...members, n]);
    setNewName("");
  }

  function removeMember(name) {
    if (members.length <= 1) return;
    onUpdate(members.filter(m => m !== name));
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer", color: COLORS.text, fontSize: 13 }}>
        <span>👥</span>
        <span>メンバー ({members.length})</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 999, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, width: 220, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textLight, marginBottom: 10, letterSpacing: 0.5 }}>メンバー管理</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {members.map(m => (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar name={m} />
                <span style={{ flex: 1, fontSize: 13, color: COLORS.text }}>{m}</span>
                {members.length > 1 && (
                  <button onClick={() => removeMember(m)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight, fontSize: 14, padding: "0 4px" }}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addMember()} placeholder="名前を追加" style={inputStyle({ flex: 1, fontSize: 12, padding: "5px 8px" })} />
            <button onClick={addMember} style={{ background: COLORS.primary, border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", color: "#0F1117", fontSize: 12, fontWeight: 700 }}>追加</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── マイToDoセクション ──
function MyTodoSection({ clients, projects, members, currentMember, onChangeMember, onClientClick }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  function handleMemberClick(m) {
    if (currentMember === m && open) {
      // 同じメンバーをもう一度クリックで折りたたむ
      setOpen(false);
      onChangeMember(null);
    } else {
      onChangeMember(m);
      setOpen(true);
    }
  }

  const myTodos = [];
  if (currentMember) {
    clients.filter(c => !c.archived && !c.isPotential).forEach(client => {
      const project = projects.find(p => p.id === client.projectId);
      (client.todos || []).filter(t => !t.done).forEach(todo => {
        const owners = todo.owners || (todo.owner ? [todo.owner] : []);
        if (owners.includes(currentMember)) {
          myTodos.push({ todo, client, project });
        }
      });
    });
  }

  const overdue = myTodos.filter(({ todo }) => todo.due && new Date(todo.due) < now)
    .sort((a, b) => new Date(a.todo.due) - new Date(b.todo.due));
  const thisWeek = myTodos.filter(({ todo }) => todo.due && new Date(todo.due) >= now && new Date(todo.due) <= oneWeekLater)
    .sort((a, b) => new Date(a.todo.due) - new Date(b.todo.due));
  const later = myTodos.filter(({ todo }) => !todo.due || new Date(todo.due) > oneWeekLater)
    .sort((a, b) => (a.todo.due || "9999") > (b.todo.due || "9999") ? 1 : -1);

  function TodoRow({ todo, client, project }) {
    const dueDate = todo.due ? new Date(todo.due) : null;
    const isOD = dueDate && dueDate < now;
    const diffDays = dueDate ? Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)) : null;
    return (
      <div onClick={() => onClientClick(client)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderRadius: 6, cursor: "pointer", background: COLORS.card, border: `1px solid ${COLORS.border}`, transition: "border-color 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.primary}
        onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.border}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{todo.text}</div>
          <div style={{ fontSize: 11, color: COLORS.textLight }}>{project?.name} › {client.name}</div>
        </div>
        {dueDate && (
          <span style={{ fontSize: 11, color: isOD ? COLORS.danger : diffDays <= 2 ? COLORS.warning : COLORS.textLight, fontWeight: 600, flexShrink: 0 }}>
            {isOD ? `${Math.abs(diffDays)}日超過` : diffDays === 0 ? "今日" : `${diffDays}日後`}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px" }}>
        {/* ヘッダー行 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 44 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textLight, letterSpacing: 0.5, flexShrink: 0 }}>マイToDo</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {members.map(m => (
              <button key={m} onClick={() => handleMemberClick(m)} style={{ display: "flex", alignItems: "center", gap: 4, background: currentMember === m && open ? COLORS.primaryLight : "none", border: `1px solid ${currentMember === m && open ? COLORS.primary : COLORS.border}`, borderRadius: 20, padding: "2px 10px 2px 6px", cursor: "pointer", transition: "all 0.15s" }}>
                <Avatar name={m} />
                <span style={{ fontSize: 12, color: currentMember === m && open ? COLORS.primary : COLORS.textLight, fontWeight: currentMember === m && open ? 700 : 400 }}>{m}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 展開コンテンツ */}
        {open && currentMember && (
          <div style={{ paddingBottom: 16 }}>
            {myTodos.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.textLight, padding: "8px 0" }}>{currentMember} に割り当てられたToDoはありません</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 8 }}>
                {overdue.map(({ todo, client, project }, i) => (
                  <div key={`od-${i}`} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12 }}>🔴</span>
                    <div style={{ flex: 1 }}><TodoRow todo={todo} client={client} project={project} /></div>
                  </div>
                ))}
                {thisWeek.map(({ todo, client, project }, i) => (
                  <div key={`tw-${i}`} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12 }}>🟡</span>
                    <div style={{ flex: 1 }}><TodoRow todo={todo} client={client} project={project} /></div>
                  </div>
                ))}
                {later.map(({ todo, client, project }, i) => (
                  <div key={`lt-${i}`} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12 }}>📋</span>
                    <div style={{ flex: 1 }}><TodoRow todo={todo} client={client} project={project} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── パスワード認証 ──
function LoginScreen({ onLogin }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (input === APP_PASSWORD) {
      onLogin();
    } else {
      setError(true);
      setInput("");
      setTimeout(() => setError(false), 2000);
    }
  }

  return (
    <div style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", background: COLORS.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 320, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 56, height: 56, background: COLORS.primary, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#0F1117", fontSize: 26, fontWeight: 700 }}>岡</span>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>Okayama CRM</div>
            <div style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4 }}>dataSpring</div>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 6 }}>パスワード</div>
            <input
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="パスワードを入力"
              autoFocus
              style={{ ...inputStyle(), fontSize: 14, padding: "10px 12px", border: `1px solid ${error ? COLORS.danger : COLORS.border}`, transition: "border-color 0.2s" }}
            />
            {error && <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 6 }}>パスワードが正しくありません</div>}
          </div>
          <button type="submit" style={{ background: COLORS.primary, border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", color: "#0F1117", fontSize: 14, fontWeight: 700, width: "100%" }}>
            ログイン
          </button>
        </form>
      </div>
    </div>
  );
}

// ── ルート ──
export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem("okayama_crm_auth") === "1");

  if (!loggedIn) {
    return <LoginScreen onLogin={() => { sessionStorage.setItem("okayama_crm_auth", "1"); setLoggedIn(true); }} />;
  }

  return <AppMain />;
}

function AppMain() {
  const [projects, setProjects] = useState(PROJECTS_INIT);
  const [clients, setClients] = useState(CLIENTS_INIT);
  const [members, setMembers] = useState(["Takuya"]);
  const [currentMember, setCurrentMember] = useState(null);

  // membersが変わったらOWNERSグローバル変数を同期
  useEffect(() => { OWNERS = members; }, [members]);
  const [view, setView] = useState("projects");
  const [filterType, setFilterType] = useState(null);
  const prevViewRef = useRef("projects");
  const [isLoading, setIsLoading] = useState(true);
  const nextProjectId = useRef(1);
  const nextClientId = useRef(1);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedPotential, setSelectedPotential] = useState(null);
  const [showArchive, setShowArchive] = useState(false);

  // GAS連携状態
  const [syncStatus, setSyncStatus] = useState("idle");
  const [gasEnabled] = useState(GAS_URL !== "aaaaaaaaaa");
  const saveTimerRef = useRef(null);
  const isFirstLoad = useRef(true);

  // 起動時にGASからデータ読み込み
  useEffect(() => {
    if (!gasEnabled) { setIsLoading(false); return; }
    setSyncStatus("loading");
    loadFromGAS()
      .then(({ projects: p, clients: c, members: m }) => {
        if (p && p.length > 0) {
          setProjects(p);
          nextProjectId.current = Math.max(...p.map(x => x.id)) + 1;
        }
        if (c && c.length > 0) {
          setClients(c);
          nextClientId.current = Math.max(...c.map(x => x.id)) + 1;
        }
        if (m && m.length > 0) {
          setMembers(m);
          setCurrentMember(m[0]);
        }
        setSyncStatus("saved");
      })
      .catch(() => setSyncStatus("error"))
      .finally(() => { isFirstLoad.current = false; setIsLoading(false); });
  }, []);

  // データ変更時にdebounce（1秒）して自動保存
  useEffect(() => {
    if (!gasEnabled || isFirstLoad.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSyncStatus("saving");
    saveTimerRef.current = setTimeout(() => {
      saveToGAS(projects, clients, members)
        .then(() => setSyncStatus("saved"))
        .catch(() => setSyncStatus("error"));
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [projects, clients, members]);

  function goToProject(project) { setSelectedProject(project); prevViewRef.current = "projects"; setView("project"); setShowArchive(false); }
  function goToClient(client) { setSelectedClient(client); prevViewRef.current = view; setView("client"); }
  function goToPotential(potential) { setSelectedPotential(potential); prevViewRef.current = view; setView("potential"); }
  function goToTop() { setSelectedProject(null); setSelectedClient(null); setSelectedPotential(null); setView("projects"); setShowArchive(false); setFilterType(null); }
  function goBackToProject() {
    setSelectedClient(null);
    setSelectedPotential(null);
    if (prevViewRef.current === "filter") {
      setView("filter");
    } else {
      setView("project");
    }
  }
  function goToFilter(type) { setFilterType(type); setView("filter"); }

  function archiveProject(id) {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, archived: true } : p));
    setClients(prev => prev.map(c => c.projectId === id ? { ...c, archived: true } : c));
  }

  function restoreProject(id) {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, archived: false } : p));
  }

  function deleteProject(id) {
    setProjects(prev => prev.filter(p => p.id !== id));
    setClients(prev => prev.filter(c => c.projectId !== id));
  }

  function deleteClient(id) {
    setClients(prev => prev.filter(c => c.id !== id));
  }

  function archiveClient(id) {
    setClients(prev => prev.map(c => c.id === id ? { ...c, archived: true } : c));
    if (view === "client") goBackToProject();
  }

  function restoreClient(id) {
    setClients(prev => prev.map(c => c.id === id ? { ...c, archived: false } : c));
  }

  function sortTodos(todos) {
    return [...todos].sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    });
  }

  function toggleTodo(clientId, todoIndex) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      const newTodos = c.todos.map((t, i) => i === todoIndex ? { ...t, done: !t.done } : t);
      return { ...c, todos: newTodos, lastUpdated: today() };
    }));
  }

  function addMaterial(clientId, material) {
    if (Array.isArray(material)) {
      setClients(prev => prev.map(c =>
        c.id === clientId ? { ...c, materials: [...c.materials, ...material], lastUpdated: today() } : c
      ));
    } else {
      setClients(prev => prev.map(c =>
        c.id === clientId ? { ...c, materials: [...c.materials, material], lastUpdated: today() } : c
      ));
    }
  }

  function addTodo(clientId, todo) {
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, todos: sortTodos([...c.todos, todo]), lastUpdated: today() } : c
    ));
  }

  function updateMaterial(clientId, index, updated) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      const newMaterials = c.materials.map((m, i) => i === index ? updated : m);
      return { ...c, materials: newMaterials, lastUpdated: today() };
    }));
  }

  function reorderMaterials(clientId, newMaterials) {
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, materials: newMaterials, lastUpdated: today() } : c
    ));
  }

  function updateTodo(clientId, index, updated) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      const newTodos = sortTodos(c.todos.map((t, i) => i === index ? updated : t));
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
    <div style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", background: COLORS.bg, minHeight: "100vh", color: COLORS.text, margin: 0, padding: 0 }}>
      {isLoading && (
        <div style={{ position: "fixed", inset: 0, background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999, gap: 16 }}>
          <div style={{ width: 48, height: 48, background: COLORS.primary, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#0F1117", fontSize: 22, fontWeight: 700 }}>岡</span>
          </div>
          <div style={{ fontSize: 14, color: COLORS.textLight }}>読み込み中...</div>
        </div>
      )}
      {/* Nav */}
      <div style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "0 32px", display: "flex", alignItems: "center", height: 56, gap: 16, position: "sticky", top: 0, zIndex: 100 }}>
        <div onClick={goToTop} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div style={{ width: 28, height: 28, background: COLORS.primary, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#0F1117", fontSize: 14, fontWeight: 700 }}>岡</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>Okayama CRM</span>
          <span style={{ fontSize: 10, background: COLORS.primaryLight, color: COLORS.primary, padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>dataSpring</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* メンバー管理 */}
          <MemberManager members={members} onUpdate={setMembers} />
          {!gasEnabled && (
            <span style={{ fontSize: 11, color: COLORS.warning, background: "rgba(246,173,85,0.1)", padding: "3px 8px", borderRadius: 4 }}>
              ⚠ ローカルモード（GAS未設定）
            </span>
          )}
          {gasEnabled && syncStatus === "loading" && <span style={{ fontSize: 11, color: COLORS.textLight }}>⟳ 読み込み中...</span>}
          {gasEnabled && syncStatus === "saving" && <span style={{ fontSize: 11, color: COLORS.textLight }}>⟳ 保存中...</span>}
          {gasEnabled && syncStatus === "saved" && <span style={{ fontSize: 11, color: COLORS.success }}>✓ 保存済み</span>}
          {gasEnabled && syncStatus === "error" && <span style={{ fontSize: 11, color: COLORS.danger }}>✕ 保存エラー（GAS設定を確認）</span>}
        </div>
      </div>

      {/* マイToDoセクション */}
      <MyTodoSection
        clients={clients}
        projects={projects}
        members={members}
        currentMember={currentMember}
        onChangeMember={setCurrentMember}
        onClientClick={client => {
          const project = projects.find(p => p.id === client.projectId);
          if (project) { setSelectedProject(project); prevViewRef.current = view; setSelectedClient(client); setView("client"); }
        }}
      />

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
              onDeleteProject={deleteProject}
              onUpdateProject={updateProject}
              onAddProject={addProject}
              showArchive={showArchive}
              onToggleArchive={() => setShowArchive(v => !v)}
              onFilterClick={goToFilter}
              onClientClick={client => {
                const project = projects.find(p => p.id === client.projectId);
                if (project) { setSelectedProject(project); goToClient(client); }
              }}
              onCompleteTodo={toggleTodo}
            />
          </>
        )}
        {view === "filter" && (
          <FilterView
            filterType={filterType}
            projects={projects}
            clients={clients}
            onBack={goToTop}
            onSelectClient={client => {
              const project = projects.find(p => p.id === client.projectId);
              if (project) { setSelectedProject(project); goToClient(client); }
            }}
          />
        )}
        {view === "project" && selectedProject && (
          <ProjectDetail
            project={projects.find(p => p.id === selectedProject.id) || selectedProject}
            clients={clients}
            onSelectClient={goToClient} onBack={goToTop}
            onArchiveClient={archiveClient}
            onRestoreClient={restoreClient}
            onDeleteClient={deleteClient}
            onUpdateClient={updateClient}
            onUpdateProject={updateProject}
            onAddClient={addClient}
            onSelectPotential={goToPotential}
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
            onReorderMaterials={reorderMaterials}
          />
        )}
        {view === "potential" && selectedPotential && selectedProject && (
          <PotentialDetail
            client={clients.find(c => c.id === selectedPotential.id) || selectedPotential}
            project={selectedProject}
            onBackToProject={goBackToProject} onBackToTop={goToTop}
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
            onPromote={id => updateClient(id, { isPotential: false })}
            onReorderMaterials={reorderMaterials}
          />
        )}
      </div>
    </div>
  );
}
