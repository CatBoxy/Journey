"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  computeQuote,
  computePriceBreaks,
  parsePriceBreaks,
  type LineKind,
  type LineScope,
  type QuoteLineInput,
} from "@/lib/quote-engine";

// ---- Types ----

type WorkshopTab = "quotes" | "stock" | "machines" | "rates";

interface Material {
  id: number;
  name: string;
  unit: string;
  unit_cost: number;
  currency: string;
  supplier: string;
  stock_qty: number | null;
  is_metal: number | null;
  notes: string | null;
}

interface Movement {
  id: number;
  material_id: number;
  material_name: string;
  unit: string;
  currency: string;
  type: "purchase" | "job" | "rnd" | "adjustment";
  quantity: number;
  unit_cost: number;
  total_cost: number;
  stock_after: number;
  date: string;
  notes: string;
}

interface Machine {
  id: number;
  name: string;
  purchase_price: number;
  currency: string;
  usage_unit: "hour" | "cycle";
  life_uses: number;
  energy_kwh_per_use: number;
  extra_cost_per_use: number;
  notes: string;
  active: number;
  rate: { wear: number; energy: number; extra: number; rate: number };
}

interface QuoteSummary {
  id: number;
  number: string;
  title: string;
  client_name: string;
  quantity: number;
  status: QuoteStatus;
  date: string;
  valid_until: string | null;
  total: number | null;
  unit_price: number | null;
}

type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

interface EditorLine {
  key: string;
  kind: LineKind;
  scope: LineScope;
  description: string;
  quantity: string;
  unit: string;
  unit_cost: string; // "" = automatic
  material_id: number | null;
  machine_id: number | null;
  labor_type: "design" | "bench";
  apply_metal_loss: boolean;
}

type Settings = Record<string, string>;

// ---- Styles & helpers ----

const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-background text-foreground text-sm";
const btnPrimary = "px-4 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnSecondary = "px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-800";
const btnSmall = "px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-800";
const card = "p-4 border border-gray-200 dark:border-gray-800 rounded-lg";
const labelClass = "block text-xs text-gray-500 dark:text-gray-400 mb-1";

const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  accepted: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  expired: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

const KIND_LABELS: Record<LineKind, string> = {
  material: "Material",
  labor: "Labor",
  machine: "Machine",
  one_time: "One-time",
  other: "Other",
};

function money(n: number | null | undefined) {
  return `$${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function qty(n: number | null | undefined) {
  return Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function todayLocal() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10);
}

let keySeq = 0;
const newKey = () => `l${++keySeq}`;

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

function laborRate(settings: Settings, type: "design" | "bench") {
  const fallback = Number(settings.hourly_labor_rate) || 0;
  const v = Number(type === "design" ? settings.labor_rate_design : settings.labor_rate_bench);
  return v || fallback;
}

// ---- Page ----

export default function WorkshopPage() {
  const [tab, setTab] = useState<WorkshopTab>("quotes");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);

  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api<Material[]>("/api/materials"),
      api<Machine[]>("/api/machines?all=1"),
      api<Settings>("/api/settings"),
    ])
      .then(([m, mc, s]) => {
        if (!alive) return;
        setMaterials(m);
        setMachines(mc);
        setSettings(s);
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Workshop</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Presupuestos, stock, machines & rates</p>
          </div>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 transition-colors mt-1">← Journey</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
          {(["quotes", "stock", "machines", "rates"] as WorkshopTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t ? "border-foreground text-foreground" : "border-transparent text-gray-500 hover:text-foreground"
              }`}
            >
              {t === "quotes" ? "Presupuestos" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading ? <Spinner /> : (
          <>
            {tab === "quotes" && <QuotesView materials={materials} machines={machines} settings={settings} onSettingsChange={refresh} />}
            {tab === "stock" && <StockView materials={materials} onChange={refresh} />}
            {tab === "machines" && <MachinesView machines={machines} settings={settings} onChange={refresh} />}
            {tab === "rates" && <RatesView settings={settings} onChange={refresh} />}
          </>
        )}
      </div>
    </div>
  );
}

// ---- Quotes ----

function QuotesView({ materials, machines, settings, onSettingsChange }: { materials: Material[]; machines: Machine[]; settings: Settings; onSettingsChange: () => void }) {
  const [quotes, setQuotes] = useState<QuoteSummary[] | null>(null);
  const [editing, setEditing] = useState<number | "new" | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);
  useEffect(() => {
    let alive = true;
    api<QuoteSummary[]>("/api/quotes").then((q) => { if (alive) setQuotes(q); });
    return () => { alive = false; };
  }, [reloadKey]);

  async function setStatus(id: number, status: QuoteStatus) {
    await api("/api/quotes", { method: "PUT", body: JSON.stringify({ id, status }) });
    load();
  }

  if (editing !== null) {
    return (
      <QuoteEditor
        id={editing === "new" ? null : editing}
        materials={materials}
        machines={machines.filter((m) => m.active)}
        settings={settings}
        onClose={() => { setEditing(null); load(); onSettingsChange(); }}
      />
    );
  }

  const missingRates = !laborRate(settings, "bench") || !laborRate(settings, "design");

  return (
    <div>
      {missingRates && (
        <p className="mb-4 text-sm p-3 rounded-md bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Set your design and bench hourly rates in <b>Rates</b> so labor lines price automatically.
        </p>
      )}
      <div className="flex justify-end mb-4">
        <button className={btnPrimary} onClick={() => setEditing("new")}>+ New presupuesto</button>
      </div>
      {quotes === null ? <Spinner /> : quotes.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">No presupuestos yet.</p>
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => (
            <div key={q.id} className={`${card} flex flex-wrap items-center gap-3`}>
              <button className="flex-1 min-w-0 text-left" onClick={() => setEditing(q.id)}>
                <div className="text-xs text-gray-500">{q.number} · {q.date}{q.client_name ? ` · ${q.client_name}` : ""}</div>
                <div className="font-medium truncate">{q.title}</div>
                <div className="text-sm text-gray-500">
                  {q.quantity} pcs · {money(q.total)}{q.quantity > 1 ? ` (${money(q.unit_price)} c/u)` : ""}
                </div>
              </button>
              <select
                value={q.status}
                onChange={(e) => setStatus(q.id, e.target.value as QuoteStatus)}
                className={`text-xs rounded-full px-2 py-1 border-0 ${STATUS_STYLES[q.status]}`}
              >
                {(["draft", "sent", "accepted", "rejected", "expired"] as QuoteStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <a className={btnSmall} href={`/api/quotes/pdf?id=${q.id}`} target="_blank" rel="noreferrer">PDF</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function emptyLine(kind: LineKind = "material"): EditorLine {
  return {
    key: newKey(), kind, scope: kind === "machine" ? "per_batch" : "per_piece", description: "", quantity: "",
    unit: "", unit_cost: "", material_id: null, machine_id: null, labor_type: "bench", apply_metal_loss: false,
  };
}

function QuoteEditor({ id, materials, machines, settings, onClose }: { id: number | null; materials: Material[]; machines: Machine[]; settings: Settings; onClose: () => void }) {
  const [loading, setLoading] = useState(id !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<number | null>(id);
  const [number, setNumber] = useState("");
  const [f, setF] = useState({
    title: "", client_name: "", client_contact: "", description: "", quantity: "1", status: "draft" as QuoteStatus,
    date: todayLocal(), valid_until: "",
    metal_loss_pct: settings.default_metal_loss_pct ?? "5", failure_pct: settings.default_failure_pct ?? "10",
    margin_pct: settings.default_margin_pct ?? "30", deposit_pct: settings.default_deposit_pct ?? "50",
    price_breaks: "", notes: "", internal_notes: "",
  });
  const [silverPrice, setSilverPrice] = useState("");
  const [lines, setLines] = useState<EditorLine[]>([emptyLine("material")]);

  const matById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
  const machById = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);

  useEffect(() => {
    if (id === null) return;
    api<{ quote: Record<string, unknown>; lines: Record<string, unknown>[] }>(`/api/quotes?id=${id}`).then(({ quote, lines: ls }) => {
      setNumber(String(quote.number));
      const s = (k: string) => (quote[k] == null ? "" : String(quote[k]));
      setF({
        title: s("title"), client_name: s("client_name"), client_contact: s("client_contact"), description: s("description"),
        quantity: s("quantity") || "1", status: (quote.status as QuoteStatus) || "draft", date: s("date"), valid_until: s("valid_until"),
        metal_loss_pct: s("metal_loss_pct"), failure_pct: s("failure_pct"), margin_pct: s("margin_pct"), deposit_pct: s("deposit_pct"),
        price_breaks: s("price_breaks"), notes: s("notes"), internal_notes: s("internal_notes"),
      });
      setLines(ls.map((l) => ({
        key: newKey(), kind: l.kind as LineKind, scope: l.scope as LineScope, description: String(l.description ?? ""),
        quantity: String(l.quantity ?? ""), unit: String(l.unit ?? ""), unit_cost: String(l.unit_cost ?? ""),
        material_id: (l.material_id as number) ?? null, machine_id: (l.machine_id as number) ?? null,
        labor_type: (l.labor_type as "design" | "bench") || "bench", apply_metal_loss: !!l.apply_metal_loss,
      })));
      setLoading(false);
    });
  }, [id]);

  const hasMetal = lines.some((l) => l.kind === "material" && l.material_id && matById.get(l.material_id)?.is_metal);

  // Unit cost the server would use when the field is left blank.
  const autoCost = useCallback((l: EditorLine): number | null => {
    if (l.kind === "material" && l.material_id) {
      const m = matById.get(l.material_id);
      if (!m) return null;
      if (m.is_metal) return silverPrice ? Number(silverPrice) : null;
      return m.currency === "USD" ? Number(m.unit_cost) * (Number(settings.current_fx_rate) || 0) : Number(m.unit_cost);
    }
    if (l.kind === "machine" && l.machine_id) return machById.get(l.machine_id)?.rate.rate ?? null;
    if (l.kind === "labor") return laborRate(settings, l.labor_type);
    return null;
  }, [matById, machById, settings, silverPrice]);

  const preview = useMemo(() => {
    const inputs: QuoteLineInput[] = lines.map((l) => {
      const m = l.material_id ? matById.get(l.material_id) : undefined;
      const machine = l.machine_id ? machById.get(l.machine_id) : undefined;
      return {
        kind: l.kind, scope: l.scope,
        description: l.description || m?.name || machine?.name || (l.kind === "labor" ? (l.labor_type === "design" ? "Diseño / CAD" : "Trabajo de banco") : ""),
        quantity: Number(l.quantity) || 0, unit: l.unit,
        unit_cost: l.unit_cost !== "" ? Number(l.unit_cost) : autoCost(l) ?? 0,
        apply_metal_loss: l.kind === "material" && l.apply_metal_loss,
      };
    });
    const params = {
      quantity: Number(f.quantity) || 1, metal_loss_pct: Number(f.metal_loss_pct) || 0, failure_pct: Number(f.failure_pct) || 0,
      margin_pct: Number(f.margin_pct) || 0, deposit_pct: Number(f.deposit_pct) || 0,
    };
    return {
      b: computeQuote(inputs, params),
      breaks: computePriceBreaks(inputs, params, parsePriceBreaks(f.price_breaks, params.quantity)),
    };
  }, [lines, f, matById, machById, autoCost]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const setLine = (key: string, patch: Partial<EditorLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function save() {
    setError("");
    if (!f.title.trim()) { setError("Give the presupuesto a title."); return; }
    const missingMetal = lines.some((l) => l.kind === "material" && l.material_id && matById.get(l.material_id)?.is_metal && l.unit_cost === "" && !silverPrice);
    if (missingMetal) { setError("Enter today's silver price per gram, or a unit cost on the metal line."); return; }
    setSaving(true);
    try {
      const body = {
        ...f,
        quantity: Number(f.quantity) || 1,
        metal_loss_pct: Number(f.metal_loss_pct) || 0, failure_pct: Number(f.failure_pct) || 0,
        margin_pct: Number(f.margin_pct) || 0, deposit_pct: Number(f.deposit_pct) || 0,
        valid_until: f.valid_until || undefined,
        silver_price_per_g: silverPrice ? Number(silverPrice) : undefined,
        lines: lines
          .filter((l) => l.description || l.material_id || l.machine_id || l.kind === "labor")
          .map((l) => ({
            kind: l.kind, scope: l.scope, description: l.description || undefined, quantity: Number(l.quantity) || 0,
            unit: l.unit || undefined, unit_cost: l.unit_cost === "" ? undefined : Number(l.unit_cost),
            material_id: l.kind === "material" ? l.material_id : undefined,
            machine_id: l.kind === "machine" ? l.machine_id : undefined,
            labor_type: l.kind === "labor" ? l.labor_type : undefined,
            apply_metal_loss: l.kind === "material" ? l.apply_metal_loss : undefined,
          })),
      };
      const res = await api<{ quote: { id: number; number: string } }>("/api/quotes", {
        method: savedId ? "PUT" : "POST",
        body: JSON.stringify(savedId ? { id: savedId, ...body } : body),
      });
      setSavedId(res.quote.id);
      setNumber(res.quote.number);
      // Reload so automatic prices show as the saved snapshot.
      const fresh = await api<{ quote: Record<string, unknown>; lines: Record<string, unknown>[] }>(`/api/quotes?id=${res.quote.id}`);
      setF((cur) => ({ ...cur, valid_until: String(fresh.quote.valid_until ?? ""), date: String(fresh.quote.date ?? cur.date) }));
      setLines(fresh.lines.map((l) => ({
        key: newKey(), kind: l.kind as LineKind, scope: l.scope as LineScope, description: String(l.description ?? ""),
        quantity: String(l.quantity ?? ""), unit: String(l.unit ?? ""), unit_cost: String(l.unit_cost ?? ""),
        material_id: (l.material_id as number) ?? null, machine_id: (l.machine_id as number) ?? null,
        labor_type: (l.labor_type as "design" | "bench") || "bench", apply_metal_loss: !!l.apply_metal_loss,
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!savedId || !window.confirm(`Delete presupuesto ${number}?`)) return;
    await api(`/api/quotes?id=${savedId}`, { method: "DELETE" });
    onClose();
  }

  if (loading) return <Spinner />;
  const b = preview.b;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button className="text-sm text-gray-500 hover:text-foreground" onClick={onClose}>← All presupuestos</button>
        <span className="text-sm text-gray-500">{number || "New"}</span>
      </div>

      <section className={`${card} space-y-3`}>
        <input className={inputClass} placeholder="Job title (shown on the PDF)" value={f.title} onChange={set("title")} />
        <textarea className={inputClass} rows={2} placeholder="Description for the client (optional)" value={f.description} onChange={set("description")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={inputClass} placeholder="Client name" value={f.client_name} onChange={set("client_name")} />
          <input className={inputClass} placeholder="Client contact" value={f.client_contact} onChange={set("client_contact")} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className={labelClass}>Pieces</label><input className={inputClass} type="number" min="1" step="1" value={f.quantity} onChange={set("quantity")} /></div>
          <div><label className={labelClass}>Date</label><input className={inputClass} type="date" value={f.date} onChange={set("date")} /></div>
          <div><label className={labelClass}>Valid until</label><input className={inputClass} type="date" value={f.valid_until} onChange={set("valid_until")} placeholder="auto" /></div>
          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={f.status} onChange={set("status")}>
              {(["draft", "sent", "accepted", "rejected", "expired"] as QuoteStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className={`${card} space-y-3 ${hasMetal && !silverPrice ? "border-amber-400 dark:border-amber-600" : ""}`}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>Silver today ($/g)</label>
            <input className={inputClass} type="number" min="0" step="0.01" value={silverPrice} onChange={(e) => setSilverPrice(e.target.value)}
              placeholder={settings.last_silver_price_per_g ? `last: ${settings.last_silver_price_per_g}` : "replacement price"} />
            {settings.last_silver_price_per_g && (
              <p className="text-[11px] text-gray-400 mt-1">Last used {money(Number(settings.last_silver_price_per_g))} on {settings.last_silver_price_date}</p>
            )}
          </div>
          <div><label className={labelClass}>Metal loss %</label><input className={inputClass} type="number" min="0" step="0.1" value={f.metal_loss_pct} onChange={set("metal_loss_pct")} /></div>
          <div><label className={labelClass}>Failure %</label><input className={inputClass} type="number" min="0" step="0.1" value={f.failure_pct} onChange={set("failure_pct")} /></div>
          <div><label className={labelClass}>Margin %</label><input className={inputClass} type="number" min="0" step="0.1" value={f.margin_pct} onChange={set("margin_pct")} /></div>
          <div><label className={labelClass}>Deposit %</label><input className={inputClass} type="number" min="0" step="1" value={f.deposit_pct} onChange={set("deposit_pct")} /></div>
        </div>
        <p className="text-xs text-gray-400">
          Silver price applies to metal lines without their own unit cost. Failure % covers recurring costs (not one-time ones); margin goes on top of everything.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Lines</h2>
        {lines.map((l, i) => {
          const auto = autoCost(l);
          const computed = b.lines[i];
          const mat = l.material_id ? matById.get(l.material_id) : undefined;
          return (
            <div key={l.key} className={`${card} space-y-2`}>
              <div className="flex flex-wrap gap-2 items-center">
                <select className={inputClass + " !w-auto"} value={l.kind} onChange={(e) => {
                  const kind = e.target.value as LineKind;
                  setLine(l.key, { kind, scope: kind === "machine" ? "per_batch" : l.scope, material_id: null, machine_id: null, unit: "" });
                }}>
                  {(Object.keys(KIND_LABELS) as LineKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                </select>

                {l.kind === "material" && (
                  <select className={inputClass + " !w-auto flex-1 min-w-40"} value={l.material_id ?? ""} onChange={(e) => {
                    const m = matById.get(Number(e.target.value));
                    setLine(l.key, { material_id: m ? m.id : null, unit: m?.unit || "", apply_metal_loss: !!m?.is_metal });
                  }}>
                    <option value="">Free text material…</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}{m.is_metal ? " (metal)" : ` · ${money(m.unit_cost)}/${m.unit} · ${qty(m.stock_qty)} ${m.unit} in stock`}
                      </option>
                    ))}
                  </select>
                )}
                {l.kind === "machine" && (
                  <select className={inputClass + " !w-auto flex-1 min-w-40"} value={l.machine_id ?? ""} onChange={(e) => {
                    const m = machById.get(Number(e.target.value));
                    setLine(l.key, { machine_id: m ? m.id : null, unit: m ? (m.usage_unit === "cycle" ? "ciclo" : "h") : "" });
                  }}>
                    <option value="">Pick a machine…</option>
                    {machines.map((m) => <option key={m.id} value={m.id}>{m.name} · {money(m.rate.rate)}/{m.usage_unit}</option>)}
                  </select>
                )}
                {l.kind === "labor" && (
                  <select className={inputClass + " !w-auto"} value={l.labor_type} onChange={(e) => setLine(l.key, { labor_type: e.target.value as "design" | "bench" })}>
                    <option value="bench">Bench work · {money(laborRate(settings, "bench"))}/h</option>
                    <option value="design">Design / CAD · {money(laborRate(settings, "design"))}/h</option>
                  </select>
                )}
                {l.kind !== "one_time" && (
                  <select className={inputClass + " !w-auto"} value={l.scope} onChange={(e) => setLine(l.key, { scope: e.target.value as LineScope })}>
                    <option value="per_piece">per piece</option>
                    <option value="per_batch">per batch</option>
                  </select>
                )}
                <button className="ml-auto text-xs text-gray-400 hover:text-red-500" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>Remove</button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
                <div className="col-span-2 sm:col-span-5">
                  <input className={inputClass} placeholder={mat?.name || (l.kind === "labor" ? (l.labor_type === "design" ? "Diseño / CAD" : "Trabajo de banco") : "Description")} value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>{l.kind === "labor" ? "Hours" : l.kind === "machine" ? "Uses" : "Qty"}</label>
                  <input className={inputClass} type="number" min="0" step="any" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} />
                </div>
                <div className="sm:col-span-1">
                  <label className={labelClass}>Unit</label>
                  <input className={inputClass} value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Unit cost</label>
                  <input className={inputClass} type="number" min="0" step="any" value={l.unit_cost} onChange={(e) => setLine(l.key, { unit_cost: e.target.value })}
                    placeholder={auto != null ? `auto ${qty(auto)}` : "ARS"} />
                </div>
                <div className="sm:col-span-2 text-right text-sm font-medium pb-2">{money(computed?.cost)}</div>
              </div>
              {l.kind === "material" && (
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input type="checkbox" checked={l.apply_metal_loss} onChange={(e) => setLine(l.key, { apply_metal_loss: e.target.checked })} />
                  Add metal loss ({f.metal_loss_pct || 0}%)
                </label>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KIND_LABELS) as LineKind[]).map((k) => (
            <button key={k} className={btnSmall} onClick={() => setLines((ls) => [...ls, emptyLine(k)])}>+ {KIND_LABELS[k]}</button>
          ))}
        </div>
      </section>

      <section className={`${card} space-y-1 text-sm`}>
        <Row label="Materials" value={b.sections.materials} />
        <Row label="Labor" value={b.sections.labor} />
        <Row label="Machines" value={b.sections.machines} />
        <Row label={`One-time (${money(b.one_time_per_unit)} per piece)`} value={b.sections.one_time} />
        {b.sections.other > 0 && <Row label="Other" value={b.sections.other} />}
        <div className="border-t border-gray-200 dark:border-gray-800 my-2" />
        <Row label="Cost subtotal" value={b.subtotal} />
        <Row label={`Failure allowance (${f.failure_pct || 0}%)`} value={b.failure_allowance} />
        <Row label={`Margin (${f.margin_pct || 0}%)`} value={b.margin} />
        <div className="border-t border-gray-200 dark:border-gray-800 my-2" />
        <Row label="Total" value={b.total} strong />
        <Row label={`Per piece (${b.quantity})`} value={b.unit_price} strong />
        <Row label={`Deposit (${f.deposit_pct || 0}%)`} value={b.deposit} />
        <div className="pt-3">
          <label className={labelClass}>Also price these quantities on the PDF (e.g. 10, 25, 50)</label>
          <input className={inputClass} value={f.price_breaks} onChange={set("price_breaks")} />
          {preview.breaks.length > 0 && (
            <div className="mt-2 text-xs text-gray-500 space-y-0.5">
              {preview.breaks.map((pb) => <div key={pb.quantity}>{pb.quantity} pcs → {money(pb.unit_price)} c/u · {money(pb.total)}</div>)}
            </div>
          )}
        </div>
      </section>

      <section className={`${card} space-y-3`}>
        <div><label className={labelClass}>Terms on the PDF (delivery time, what&apos;s included)</label><textarea className={inputClass} rows={2} value={f.notes} onChange={set("notes")} /></div>
        <div><label className={labelClass}>Internal notes (not on the PDF)</label><textarea className={inputClass} rows={2} value={f.internal_notes} onChange={set("internal_notes")} /></div>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex flex-wrap gap-2 pb-12">
        <button className={btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : savedId ? "Save" : "Create"}</button>
        {savedId && <a className={btnSecondary} href={`/api/quotes/pdf?id=${savedId}`} target="_blank" rel="noreferrer">Open PDF</a>}
        {savedId && <a className={btnSecondary} href={`/api/quotes/pdf?id=${savedId}&download=1`}>Download PDF</a>}
        <button className={btnSecondary} onClick={onClose}>Close</button>
        {savedId && <button className="ml-auto text-sm text-red-500 hover:underline" onClick={remove}>Delete</button>}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold text-base" : "text-gray-600 dark:text-gray-300"}`}>
      <span>{label}</span><span>{money(value)}</span>
    </div>
  );
}

// ---- Stock ----

function StockView({ materials, onChange }: { materials: Material[]; onChange: () => void }) {
  const [action, setAction] = useState<{ id: number; mode: "purchase" | "use" | "count" } | null>(null);
  const [adding, setAdding] = useState(false);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [rnd, setRnd] = useState<{ monthly: { month: string; currency: string; cost: number }[] }>({ monthly: [] });

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);
  useEffect(() => {
    let alive = true;
    Promise.all([api<Movement[]>("/api/stock"), api<typeof rnd>("/api/stock/rnd")]).then(([mv, r]) => {
      if (!alive) return;
      setMovements(mv);
      setRnd(r);
    });
    return () => { alive = false; };
  }, [reloadKey]);

  const done = () => { setAction(null); setAdding(false); onChange(); load(); };
  const value = materials.reduce((s, m) => s + Math.max(0, Number(m.stock_qty) || 0) * Number(m.unit_cost || 0) * (m.currency === "USD" ? 0 : 1), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className={card}><div className="text-xs text-gray-500">Stock value (ARS items)</div><div className="text-lg font-semibold">{money(value)}</div></div>
        <div className={card}>
          <div className="text-xs text-gray-500">R&D absorbed, this month</div>
          <div className="text-lg font-semibold">{money(rnd.monthly.find((r) => r.month === todayLocal().substring(0, 7))?.cost)}</div>
        </div>
      </div>

      <div className="flex justify-end"><button className={btnPrimary} onClick={() => setAdding(true)}>+ Add material</button></div>
      {adding && <MaterialForm onDone={done} onCancel={() => setAdding(false)} />}

      {materials.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No materials yet.</p> : (
        <div className="space-y-2">
          {materials.map((m) => (
            <div key={m.id} className={card}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{m.name} {m.is_metal ? <span className="text-xs text-amber-600 ml-1">metal</span> : null}</div>
                  <div className="text-sm text-gray-500">
                    {qty(m.stock_qty)} {m.unit} on hand · avg {m.currency === "USD" ? "US" : ""}{money(m.unit_cost)}/{m.unit}
                    {m.supplier ? ` · ${m.supplier}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className={btnSmall} onClick={() => setAction({ id: m.id, mode: "purchase" })}>Buy</button>
                  <button className={btnSmall} onClick={() => setAction({ id: m.id, mode: "use" })}>Use</button>
                  <button className={btnSmall} onClick={() => setAction({ id: m.id, mode: "count" })}>Count</button>
                </div>
              </div>
              {action?.id === m.id && <StockActionForm material={m} mode={action.mode} onDone={done} onCancel={() => setAction(null)} />}
            </div>
          ))}
        </div>
      )}

      {rnd.monthly.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">R&D absorbed per month</h2>
          <div className={`${card} text-sm space-y-1`}>
            {rnd.monthly.map((r) => <div key={r.month + r.currency} className="flex justify-between"><span>{r.month}</span><span>{r.currency === "USD" ? "US" : ""}{money(r.cost)}</span></div>)}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-2">Recent movements</h2>
        {movements.length === 0 ? <p className="text-sm text-gray-400">Nothing logged yet.</p> : (
          <div className="text-sm divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg">
            {movements.slice(0, 50).map((mv) => (
              <div key={mv.id} className="px-3 py-2 flex flex-wrap gap-x-3 justify-between">
                <span className="text-gray-500 w-20">{mv.date}</span>
                <span className="flex-1 min-w-32">{mv.material_name} <span className="text-xs text-gray-400">{mv.type}</span>{mv.notes ? <span className="text-xs text-gray-400"> · {mv.notes}</span> : null}</span>
                <span className={mv.quantity >= 0 ? "text-green-600" : "text-red-500"}>{mv.quantity >= 0 ? "+" : ""}{qty(mv.quantity)} {mv.unit}</span>
                <span className="w-28 text-right">{money(Math.abs(mv.total_cost))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MaterialForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("g");
  const [currency, setCurrency] = useState("ARS");
  const [supplier, setSupplier] = useState("");
  const [isMetal, setIsMetal] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/materials", { method: "POST", body: JSON.stringify({ name, unit, currency, supplier, is_metal: isMetal, unit_cost: 0 }) });
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  return (
    <form onSubmit={submit} className={`${card} space-y-3`}>
      <input className={inputClass} placeholder="Name (e.g. Revestimiento Satin Cast)" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="flex flex-wrap gap-3">
        <select className={inputClass + " !w-auto"} value={unit} onChange={(e) => setUnit(e.target.value)}>
          {["g", "ml", "unit", "cm"].map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select className={inputClass + " !w-auto"} value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="ARS">ARS</option><option value="USD">USD</option>
        </select>
        <input className={inputClass + " !w-auto flex-1"} placeholder="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isMetal} onChange={(e) => setIsMetal(e.target.checked)} /> Metal (quote at today&apos;s replacement price)</label>
      <p className="text-xs text-gray-400">Stock and average cost come from purchases. Add it, then use Buy.</p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2"><button className={btnPrimary} type="submit">Add</button><button type="button" className={btnSecondary} onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function StockActionForm({ material, mode, onDone, onCancel }: { material: Material; mode: "purchase" | "use" | "count"; onDone: () => void; onCancel: () => void }) {
  const [quantity, setQuantity] = useState("");
  const [total, setTotal] = useState("");
  const [currency, setCurrency] = useState(material.currency || "ARS");
  const [fx, setFx] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<"job" | "rnd" | "adjustment">("rnd");
  const [logExpense, setLogExpense] = useState(true);
  const [asRnd, setAsRnd] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const body =
        mode === "purchase" ? { action: "purchase", material_id: material.id, quantity: Number(quantity), total_price: Number(total), currency, fx_rate: fx ? Number(fx) : undefined, date, notes, create_expense: logExpense } :
        mode === "use" ? { action: "use", material_id: material.id, type, quantity: Number(quantity), date, notes } :
        { action: "count", material_id: material.id, counted_qty: Number(quantity), as_rnd: asRnd, notes, date };
      await api("/api/stock", { method: "POST", body: JSON.stringify(body) });
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
      <div className="flex flex-wrap gap-2 items-end">
        {mode === "use" && (
          <div>
            <label className={labelClass}>Reason</label>
            <select className={inputClass + " !w-auto"} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="rnd">R&D / internal (absorbed)</option>
              <option value="job">Client job</option>
              <option value="adjustment">Correction (+/-)</option>
            </select>
          </div>
        )}
        <div>
          <label className={labelClass}>{mode === "count" ? `Counted (${material.unit})` : mode === "use" && type === "adjustment" ? `Change (${material.unit}, +/-)` : `Quantity (${material.unit})`}</label>
          <input className={inputClass + " !w-32"} type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </div>
        {mode === "purchase" && (
          <>
            <div><label className={labelClass}>Total paid</label><input className={inputClass + " !w-36"} type="number" min="0" step="any" value={total} onChange={(e) => setTotal(e.target.value)} required /></div>
            <div><label className={labelClass}>Currency</label>
              <select className={inputClass + " !w-auto"} value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="ARS">ARS</option><option value="USD">USD</option></select>
            </div>
            {currency !== material.currency && <div><label className={labelClass}>ARS per USD</label><input className={inputClass + " !w-28"} type="number" step="any" value={fx} onChange={(e) => setFx(e.target.value)} required /></div>}
          </>
        )}
        <div><label className={labelClass}>Date</label><input className={inputClass + " !w-auto"} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <input className={inputClass} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {mode === "purchase" && (
        <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" checked={logExpense} onChange={(e) => setLogExpense(e.target.checked)} /> Also log it as an expense</label>
      )}
      {mode === "count" && (
        <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" checked={asRnd} onChange={(e) => setAsRnd(e.target.checked)} /> If there&apos;s less than expected, count the difference as R&D use</label>
      )}
      {mode === "purchase" && quantity && total && Number(quantity) > 0 && (
        <p className="text-xs text-gray-400">{money(Number(total) / Number(quantity))} per {material.unit}</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2"><button className={btnPrimary} type="submit" disabled={busy}>Save</button><button type="button" className={btnSecondary} onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

// ---- Machines ----

function MachinesView({ machines, settings, onChange }: { machines: Machine[]; settings: Settings; onChange: () => void }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  return (
    <div className="space-y-3">
      {!Number(settings.electricity_kwh_price) && (
        <p className="text-sm p-3 rounded-md bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Set the electricity price per kWh in <b>Rates</b> to include energy in machine costs.
        </p>
      )}
      <div className="flex justify-end"><button className={btnPrimary} onClick={() => setEditing("new")}>+ Add machine</button></div>
      {editing === "new" && <MachineForm onDone={() => { setEditing(null); onChange(); }} onCancel={() => setEditing(null)} />}
      {machines.map((m) => (
        <div key={m.id} className={`${card} ${m.active ? "" : "opacity-50"}`}>
          {editing === m.id ? (
            <MachineForm machine={m} onDone={() => { setEditing(null); onChange(); }} onCancel={() => setEditing(null)} />
          ) : (
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{m.name}</div>
                <div className="text-sm text-gray-500">
                  {money(m.rate.rate)} per {m.usage_unit} = wear {money(m.rate.wear)} + energy {money(m.rate.energy)} + extra {money(m.rate.extra)}
                </div>
                <div className="text-xs text-gray-400">{money(m.purchase_price)} over {qty(m.life_uses)} {m.usage_unit}s{m.notes ? ` · ${m.notes}` : ""}</div>
              </div>
              <button className={btnSmall} onClick={() => setEditing(m.id)}>Edit</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MachineForm({ machine, onDone, onCancel }: { machine?: Machine; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    name: machine?.name || "", purchase_price: String(machine?.purchase_price ?? ""), currency: machine?.currency || "ARS",
    usage_unit: machine?.usage_unit || "hour", life_uses: String(machine?.life_uses ?? ""),
    energy_kwh_per_use: String(machine?.energy_kwh_per_use ?? ""), extra_cost_per_use: String(machine?.extra_cost_per_use ?? ""),
    notes: machine?.notes || "", active: machine ? !!machine.active : true,
  });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body = {
        ...f, purchase_price: Number(f.purchase_price) || 0, life_uses: Number(f.life_uses) || 1,
        energy_kwh_per_use: Number(f.energy_kwh_per_use) || 0, extra_cost_per_use: Number(f.extra_cost_per_use) || 0,
      };
      await api("/api/machines", { method: machine ? "PUT" : "POST", body: JSON.stringify(machine ? { id: machine.id, ...body } : body) });
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input className={inputClass} placeholder="Name" value={f.name} onChange={set("name")} required />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div><label className={labelClass}>Purchase price</label><input className={inputClass} type="number" step="any" value={f.purchase_price} onChange={set("purchase_price")} /></div>
        <div><label className={labelClass}>Charged per</label>
          <select className={inputClass} value={f.usage_unit} onChange={set("usage_unit")}><option value="hour">hour</option><option value="cycle">cycle</option></select>
        </div>
        <div><label className={labelClass}>Life ({f.usage_unit}s)</label><input className={inputClass} type="number" step="any" value={f.life_uses} onChange={set("life_uses")} /></div>
        <div><label className={labelClass}>kWh per {f.usage_unit}</label><input className={inputClass} type="number" step="any" value={f.energy_kwh_per_use} onChange={set("energy_kwh_per_use")} /></div>
        <div><label className={labelClass}>Extra $ per {f.usage_unit}</label><input className={inputClass} type="number" step="any" value={f.extra_cost_per_use} onChange={set("extra_cost_per_use")} /></div>
        <div><label className={labelClass}>Currency</label>
          <select className={inputClass} value={f.currency} onChange={set("currency")}><option value="ARS">ARS</option><option value="USD">USD</option></select>
        </div>
      </div>
      <input className={inputClass} placeholder="Notes" value={f.notes} onChange={set("notes")} />
      {machine && <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active (shown in presupuestos)</label>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2"><button className={btnPrimary} type="submit">Save</button><button type="button" className={btnSecondary} onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

// ---- Rates ----

const RATE_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: "labor_rate_design", label: "Design / CAD rate (ARS per hour)" },
  { key: "labor_rate_bench", label: "Bench work rate (ARS per hour)" },
  { key: "electricity_kwh_price", label: "Electricity (ARS per kWh)", hint: "From your electricity bill: total ÷ kWh used." },
  { key: "current_fx_rate", label: "ARS per USD", hint: "Used to price materials bought in USD." },
  { key: "default_metal_loss_pct", label: "Default metal loss %" },
  { key: "default_failure_pct", label: "Default failure allowance %" },
  { key: "default_margin_pct", label: "Default margin %" },
  { key: "default_deposit_pct", label: "Default deposit %" },
  { key: "quote_validity_days", label: "Presupuesto valid for (days)" },
  { key: "business_name", label: "Business name on the PDF" },
  { key: "business_contact", label: "Contact line on the PDF", hint: "e.g. San Juan · WhatsApp 264… · @kata" },
];

function RatesView({ settings, onChange }: { settings: Settings; onChange: () => void }) {
  const [values, setValues] = useState<Settings>(() => ({ ...settings }));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      for (const { key } of RATE_FIELDS) {
        if ((values[key] ?? "") !== (settings[key] ?? "") && values[key] !== undefined && values[key] !== "") {
          await api("/api/settings", { method: "PUT", body: JSON.stringify({ key, value: values[key] }) });
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onChange();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      {RATE_FIELDS.map(({ key, label, hint }) => (
        <div key={key}>
          <label className={labelClass}>{label}</label>
          <input className={inputClass} value={values[key] ?? ""} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
          {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
        </div>
      ))}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button className={btnPrimary} type="submit">{saved ? "Saved" : "Save rates"}</button>
    </form>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-foreground rounded-full animate-spin" />
    </div>
  );
}
