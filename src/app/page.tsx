"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Tab = "feed" | "techniques" | "equipment" | "books" | "projects" | "accounting";

interface Technique {
  id: number;
  name: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  status: "want_to_learn" | "learning" | "mastered";
  category: string;
}

interface Equipment {
  id: number;
  name: string;
  description: string;
  priority: "low" | "medium" | "high";
  purchased: number;
  url: string;
  price: number | null;
}

interface Book {
  id: number;
  title: string;
  author: string;
  description: string;
  status: "want_to_read" | "reading" | "read";
  url: string;
}

interface EntryImage {
  id: number;
  filename: string;
  original_name: string;
  url: string;
}

interface Entry {
  id: number;
  technique_id: number;
  text: string;
  minutes_spent: number | null;
  created_at: string;
  images: EntryImage[];
  books: Book[];
  equipment: Equipment[];
}

interface TimeStats {
  total_minutes: number;
  total_entry_count: number;
  tracked_entry_count: number;
  first_entry: string | null;
  last_entry: string | null;
  monthly: Array<{ month: string; minutes: number; entries: number }>;
}

interface CostRollup {
  spent: number;
  to_spend: number;
  total: number;
}

interface FeedEntry extends Entry {
  technique_name: string;
}

interface Project {
  id: number;
  name: string;
  description: string;
  status: "planned" | "in_progress" | "completed";
}

interface ProjectEntry {
  id: number;
  project_id: number;
  text: string;
  created_at: string;
  images: EntryImage[];
}

type AccountingSubTab = "treasury" | "expenses" | "sales" | "products";

interface Product {
  id: number;
  name: string;
  description: string;
  materials: string;
  currency: string;
  status: "in_progress" | "completed" | "sold";
}

interface Expense {
  id: number;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  notes: string;
}

interface Sale {
  id: number;
  product_id: number | null;
  product_name: string | null;
  description: string;
  amount: number;
  currency: string;
  customer: string;
  notes: string;
  date: string;
}

interface Treasury {
  expenses_ars: number;
  expenses_usd: number;
  sales_ars: number;
  sales_usd: number;
  net_ars: number;
  net_usd: number;
  monthly_target_ars?: number;
  monthly_target_usd?: number;
  months?: number;
}

interface ProductWorkEntry {
  id: number;
  product_id: number;
  text: string;
  minutes_spent: number | null;
  created_at: string;
  images: EntryImage[];
}

interface ProductTimeStats {
  total_minutes: number;
  total_entry_count: number;
  tracked_entry_count: number;
  first_entry: string | null;
  last_entry: string | null;
}

const DIFFICULTY_COLORS = {
  beginner: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  advanced: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const STATUS_COLORS = {
  want_to_learn: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  learning: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  mastered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  medium: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const BOOK_STATUS_COLORS = {
  want_to_read: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  reading: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  read: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

const PROJECT_STATUS_COLORS = {
  planned: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

const PRODUCT_STATUS_COLORS = {
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  sold: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  materials: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  tools: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  courses: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  shipping: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  packaging: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

function formatLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-background text-foreground text-sm";
const btnPrimary =
  "px-4 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90";
const btnSecondary =
  "px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-800";

export default function Home() {
  const [tab, setTab] = useState<Tab>("feed");
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  // Technique-specific: viewing = detail page, editModal = edit sheet
  const [viewingTechnique, setViewingTechnique] = useState<number | null>(null);
  const [editModalTechnique, setEditModalTechnique] = useState<number | null>(null);
  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewingProject, setViewingProject] = useState<number | null>(null);
  const [editModalProject, setEditModalProject] = useState<number | null>(null);
  // Accounting
  const [accountingSubTab, setAccountingSubTab] = useState<AccountingSubTab>("treasury");
  const [acctProducts, setAcctProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [viewingProduct, setViewingProduct] = useState<number | null>(null);
  const [editModalProduct, setEditModalProduct] = useState<number | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const fetchAll = useCallback(async () => {
    const [t, e, b, f, p, prod, exp, sal, tres] = await Promise.all([
      fetch("/api/techniques").then((r) => r.json()),
      fetch("/api/equipment").then((r) => r.json()),
      fetch("/api/books").then((r) => r.json()),
      fetch("/api/entries").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/sales").then((r) => r.json()),
      fetch("/api/treasury").then((r) => r.json()),
    ]);
    setTechniques(t);
    setEquipment(e);
    setBooks(b);
    setFeedEntries(f);
    setProjects(p);
    setAcctProducts(prod);
    setExpenses(exp);
    setSales(sal);
    setTreasury(tres);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  const isViewingTechnique = tab === "techniques" && viewingTechnique !== null;
  const isViewingProject = tab === "projects" && viewingProject !== null;
  const isViewingProduct = tab === "accounting" && viewingProduct !== null;
  const isViewingDetail = isViewingTechnique || isViewingProject || isViewingProduct;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Journey</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Techniques, projects, equipment & books
            </p>
          </div>
          <button
            onClick={async () => {
              await fetch("/api/auth", { method: "DELETE" });
              window.location.href = "/login";
            }}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors mt-1"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs - hidden when viewing detail pages */}
        {!isViewingDetail && (
          <>
            <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
              {(["feed", "techniques", "equipment", "books", "projects", "accounting"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); closeForm(); }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    tab === t
                      ? "border-foreground text-foreground"
                      : "border-transparent text-gray-500 hover:text-foreground"
                  }`}
                >
                  {formatLabel(t)}
                </button>
              ))}
            </div>

            {tab !== "feed" && !(tab === "accounting" && accountingSubTab === "treasury") && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => { setShowForm(true); setEditing(null); }}
                  className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  + Add{" "}
                  {tab === "techniques" ? "Technique" : tab === "equipment" ? "Equipment" : tab === "projects" ? "Project" : tab === "accounting" ? (accountingSubTab === "expenses" ? "Expense" : accountingSubTab === "sales" ? "Sale" : "Product") : "Book"}
                </button>
              </div>
            )}
          </>
        )}

        {/* --- FEED --- */}
        {tab === "feed" && (
          loading ? <Spinner /> : (
            <div className="space-y-4">
              {feedEntries.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-12">No journal entries yet. Open a technique and start journaling.</p>
              )}
              {feedEntries.map((entry) => (
                <div key={entry.id} className="space-y-1">
                  <button
                    onClick={() => { setTab("techniques"); setViewingTechnique(entry.technique_id as number); }}
                    className="text-xs font-medium text-gray-500 hover:text-foreground"
                  >
                    {entry.technique_name as string}
                  </button>
                  <EntryCard entry={entry} onDelete={async () => {
                    if (await confirm("Delete this journal entry?")) {
                      await fetch(`/api/techniques/entries?id=${entry.id}`, { method: "DELETE" });
                      fetchAll();
                    }
                  }} onUpdated={fetchAll} />
                </div>
              ))}
            </div>
          )
        )}

        {/* --- TECHNIQUES --- */}
        {tab === "techniques" && !isViewingTechnique && (
          <>
            {showForm && (
              <TechniqueForm
                onDone={() => { closeForm(); fetchAll(); }}
                onCancel={closeForm}
              />
            )}
            {loading ? <Spinner /> : <TechniqueList
              items={techniques}
              onOpen={(id) => setViewingTechnique(id)}
              onEdit={(id) => setEditModalTechnique(id)}
              onDelete={async (id) => {
                if (await confirm("Delete this technique and all its entries?")) {
                  await fetch(`/api/techniques?id=${id}`, { method: "DELETE" });
                  fetchAll();
                }
              }}
            />}
          </>
        )}

        {isViewingTechnique && (
          <TechniqueDetail
            technique={techniques.find((t) => t.id === viewingTechnique)!}
            allBooks={books}
            allEquipment={equipment}
            onBack={() => setViewingTechnique(null)}
            onEdit={() => setEditModalTechnique(viewingTechnique)}
          />
        )}

        {/* Edit technique modal */}
        {editModalTechnique !== null && (
          <EditTechniqueModal
            technique={techniques.find((t) => t.id === editModalTechnique)!}
            onSave={() => { setEditModalTechnique(null); fetchAll(); }}
            onClose={() => setEditModalTechnique(null)}
          />
        )}

        {/* --- EQUIPMENT --- */}
        {tab === "equipment" && (
          <>
            {showForm && editing === null && (
              <EquipmentForm
                onDone={() => { closeForm(); fetchAll(); }}
                onCancel={closeForm}
              />
            )}
            {loading ? <Spinner /> : <EquipmentList
              items={equipment}
              editingId={editing}
              onEdit={(id) => { setEditing(id); setShowForm(true); }}
              onCancelEdit={closeForm}
              onSaveEdit={() => { closeForm(); fetchAll(); }}
              onDelete={async (id) => {
                if (await confirm("Delete this equipment?")) {
                  await fetch(`/api/equipment?id=${id}`, { method: "DELETE" });
                  fetchAll();
                }
              }}
              onTogglePurchased={(item) => {
                fetch("/api/equipment", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...item, purchased: item.purchased ? 0 : 1 }),
                }).then(fetchAll);
              }}
            />}
          </>
        )}

        {/* --- BOOKS --- */}
        {tab === "books" && (
          <>
            {showForm && editing === null && (
              <BookForm
                onDone={() => { closeForm(); fetchAll(); }}
                onCancel={closeForm}
              />
            )}
            {loading ? <Spinner /> : <BookList
              items={books}
              editingId={editing}
              onEdit={(id) => { setEditing(id); setShowForm(true); }}
              onCancelEdit={closeForm}
              onSaveEdit={() => { closeForm(); fetchAll(); }}
              onDelete={async (id) => {
                if (await confirm("Delete this book?")) {
                  await fetch(`/api/books?id=${id}`, { method: "DELETE" });
                  fetchAll();
                }
              }}
            />}
          </>
        )}

        {/* --- PROJECTS --- */}
        {tab === "projects" && !isViewingProject && (
          <>
            {showForm && (
              <ProjectForm
                onDone={() => { closeForm(); fetchAll(); }}
                onCancel={closeForm}
              />
            )}
            {loading ? <Spinner /> : <ProjectList
              items={projects}
              onOpen={(id) => setViewingProject(id)}
              onEdit={(id) => setEditModalProject(id)}
              onDelete={async (id) => {
                if (await confirm("Delete this project and all its entries?")) {
                  await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
                  fetchAll();
                }
              }}
            />}
          </>
        )}

        {isViewingProject && (
          <ProjectDetail
            project={projects.find((p) => p.id === viewingProject)!}
            allTechniques={techniques}
            allBooks={books}
            allEquipment={equipment}
            onBack={() => setViewingProject(null)}
            onEdit={() => setEditModalProject(viewingProject)}
          />
        )}

        {editModalProject !== null && (
          <EditProjectModal
            project={projects.find((p) => p.id === editModalProject)!}
            onSave={() => { setEditModalProject(null); fetchAll(); }}
            onClose={() => setEditModalProject(null)}
          />
        )}

        {/* --- ACCOUNTING --- */}
        {tab === "accounting" && !isViewingProduct && (
          <>
            {/* Sub-tab navigation */}
            <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
              {(["treasury", "expenses", "sales", "products"] as AccountingSubTab[]).map((st) => (
                <button
                  key={st}
                  onClick={() => { setAccountingSubTab(st); closeForm(); }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    accountingSubTab === st
                      ? "border-foreground text-foreground"
                      : "border-transparent text-gray-500 hover:text-foreground"
                  }`}
                >
                  {formatLabel(st)}
                </button>
              ))}
            </div>

            {/* TREASURY SUB-TAB */}
            {accountingSubTab === "treasury" && (
              loading ? <Spinner /> : (
                <TreasuryView treasury={treasury} />
              )
            )}

            {/* EXPENSES SUB-TAB */}
            {accountingSubTab === "expenses" && (
              <>
                {showForm && editing === null && (
                  <ExpenseForm
                    onDone={() => { closeForm(); fetchAll(); }}
                    onCancel={closeForm}
                  />
                )}
                {loading ? <Spinner /> : <ExpenseList
                  items={expenses}
                  editingId={editing}
                  onEdit={(id) => { setEditing(id); setShowForm(true); }}
                  onCancelEdit={closeForm}
                  onSaveEdit={() => { closeForm(); fetchAll(); }}
                  onDelete={async (id) => {
                    if (await confirm("Delete this expense?")) {
                      await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
                      fetchAll();
                    }
                  }}
                />}
              </>
            )}

            {/* SALES SUB-TAB */}
            {accountingSubTab === "sales" && (
              <>
                {showForm && editing === null && (
                  <SaleForm
                    products={acctProducts}
                    onDone={() => { closeForm(); fetchAll(); }}
                    onCancel={closeForm}
                  />
                )}
                {loading ? <Spinner /> : <SaleList
                  items={sales}
                  editingId={editing}
                  products={acctProducts}
                  onEdit={(id) => { setEditing(id); setShowForm(true); }}
                  onCancelEdit={closeForm}
                  onSaveEdit={() => { closeForm(); fetchAll(); }}
                  onDelete={async (id) => {
                    if (await confirm("Delete this sale?")) {
                      await fetch(`/api/sales?id=${id}`, { method: "DELETE" });
                      fetchAll();
                    }
                  }}
                />}
              </>
            )}

            {/* PRODUCTS SUB-TAB */}
            {accountingSubTab === "products" && (
              <>
                {showForm && (
                  <ProductForm
                    onDone={() => { closeForm(); fetchAll(); }}
                    onCancel={closeForm}
                  />
                )}
                {loading ? <Spinner /> : <ProductList
                  items={acctProducts}
                  onOpen={(id) => setViewingProduct(id)}
                  onEdit={(id) => setEditModalProduct(id)}
                  onDelete={async (id) => {
                    if (await confirm("Delete this product and all its work entries?")) {
                      await fetch(`/api/products?id=${id}`, { method: "DELETE" });
                      fetchAll();
                    }
                  }}
                />}
              </>
            )}
          </>
        )}

        {isViewingProduct && (
          <ProductDetail
            product={acctProducts.find((p) => p.id === viewingProduct)!}
            onBack={() => setViewingProduct(null)}
            onEdit={() => setEditModalProduct(viewingProduct)}
          />
        )}

        {editModalProduct !== null && (
          <EditProductModal
            product={acctProducts.find((p) => p.id === editModalProduct)!}
            onSave={() => { setEditModalProduct(null); fetchAll(); }}
            onClose={() => setEditModalProduct(null)}
          />
        )}
      </div>
      {confirmDialog()}
    </div>
  );
}

/* ================================================================
   EDIT TECHNIQUE MODAL — slide-up sheet
   ================================================================ */

function EditTechniqueModal({
  technique,
  onSave,
  onClose,
}: {
  technique: Technique;
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(technique.name);
  const [description, setDescription] = useState(technique.description);
  const [difficulty, setDifficulty] = useState(technique.difficulty);
  const [status, setStatus] = useState(technique.status);
  const [category, setCategory] = useState(technique.category || "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/techniques", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: technique.id, name, description, difficulty, status, category }),
    });
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-lg bg-background border border-gray-200 dark:border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Edit Technique</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input className={inputClass} placeholder="Technique name" value={name} onChange={(e) => setName(e.target.value)} required disabled={saving} />
          <textarea className={inputClass} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={saving} />
          <div className="flex gap-3">
            <select className={inputClass + " !w-auto"} value={difficulty} onChange={(e) => setDifficulty(e.target.value as Technique["difficulty"])} disabled={saving}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <select className={inputClass + " !w-auto"} value={status} onChange={(e) => setStatus(e.target.value as Technique["status"])} disabled={saving}>
              <option value="want_to_learn">Want to Learn</option>
              <option value="learning">Learning</option>
              <option value="mastered">Mastered</option>
            </select>
          </div>
          <input className={inputClass} placeholder="Category (e.g. soldering, finishing)" value={category} onChange={(e) => setCategory(e.target.value)} disabled={saving} />
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className={btnPrimary}>{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={onClose} disabled={saving} className={btnSecondary}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================================================================
   TECHNIQUE DETAIL — journal + links (no edit form)
   ================================================================ */

type DetailTab = "journal" | "books" | "equipment" | "images";

interface TechniqueImage {
  id: number;
  filename: string;
  original_name: string;
  url: string;
}

function TechniqueDetail({
  technique,
  allBooks,
  allEquipment,
  onBack,
  onEdit,
}: {
  technique: Technique;
  allBooks: Book[];
  allEquipment: Equipment[];
  onBack: () => void;
  onEdit: () => void;
}) {
  const [detailTab, setDetailTab] = useState<DetailTab>("journal");
  const [linkedBooks, setLinkedBooks] = useState<Book[]>([]);
  const [linkedEquipment, setLinkedEquipment] = useState<Equipment[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [images, setImages] = useState<TechniqueImage[]>([]);
  const [timeStats, setTimeStats] = useState<TimeStats | null>(null);
  const [costRollup, setCostRollup] = useState<CostRollup | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fetchLinks = useCallback(() => {
    return fetch(`/api/techniques/links?techniqueId=${technique.id}`)
      .then((r) => r.json())
      .then((data) => {
        setLinkedBooks(data.books);
        setLinkedEquipment(data.equipment);
        if (data.cost) setCostRollup(data.cost);
      });
  }, [technique.id]);

  const fetchEntries = useCallback(() => {
    return fetch(`/api/techniques/entries?techniqueId=${technique.id}`)
      .then((r) => r.json())
      .then(setEntries);
  }, [technique.id]);

  const fetchImages = useCallback(() => {
    return fetch(`/api/techniques/images?techniqueId=${technique.id}`)
      .then((r) => r.json())
      .then(setImages);
  }, [technique.id]);

  const fetchStats = useCallback(() => {
    return fetch(`/api/techniques/stats?techniqueId=${technique.id}`)
      .then((r) => r.json())
      .then(setTimeStats);
  }, [technique.id]);

  useEffect(() => {
    Promise.all([fetchLinks(), fetchEntries(), fetchImages(), fetchStats()]).then(() => setDetailLoading(false));
  }, [fetchLinks, fetchEntries, fetchImages, fetchStats]);

  async function linkItem(type: "book" | "equipment", targetId: number) {
    await fetch("/api/techniques/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ techniqueId: technique.id, type, targetId }),
    });
    fetchLinks();
  }

  async function unlinkItem(type: "book" | "equipment", targetId: number) {
    await fetch(
      `/api/techniques/links?techniqueId=${technique.id}&type=${type}&targetId=${targetId}`,
      { method: "DELETE" }
    );
    fetchLinks();
  }

  const { confirm: confirmDetail, dialog: confirmDetailDialog } = useConfirm();

  async function deleteEntry(entryId: number) {
    if (!await confirmDetail("Delete this journal entry?")) return;
    await fetch(`/api/techniques/entries?id=${entryId}`, { method: "DELETE" });
    fetchEntries();
  }

  async function uploadImage(file: File) {
    const formData = new FormData();
    formData.append("techniqueId", String(technique.id));
    formData.append("file", file);
    await fetch("/api/techniques/images", { method: "POST", body: formData });
    fetchImages();
  }

  async function deleteImage(imageId: number) {
    if (!await confirmDetail("Delete this image?")) return;
    await fetch(`/api/techniques/images?id=${imageId}`, { method: "DELETE" });
    fetchImages();
  }

  const unlinkedBooks = allBooks.filter((b) => !linkedBooks.some((lb) => lb.id === b.id));
  const unlinkedEquipment = allEquipment.filter(
    (eq) => !linkedEquipment.some((le) => le.id === eq.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-foreground">
          &larr; Back
        </button>
        <button onClick={onEdit} className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-500 hover:text-foreground hover:border-gray-400">
          Edit
        </button>
      </div>

      <div>
        <h2 className="text-xl font-bold">{technique.name}</h2>
        {technique.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{technique.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[technique.difficulty]}`}>
            {formatLabel(technique.difficulty)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[technique.status]}`}>
            {formatLabel(technique.status)}
          </span>
          {technique.category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              {technique.category}
            </span>
          )}
        </div>
        {/* Stats bar */}
        {!detailLoading && (timeStats || costRollup) && (
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
            {timeStats && timeStats.total_minutes > 0 && (
              <span>{Math.round(timeStats.total_minutes / 60 * 10) / 10}h logged</span>
            )}
            {timeStats && timeStats.total_entry_count > 0 && (
              <span>{timeStats.total_entry_count} entries{timeStats.tracked_entry_count > 0 && timeStats.tracked_entry_count < timeStats.total_entry_count ? ` (${timeStats.tracked_entry_count} tracked)` : ""}</span>
            )}
            {costRollup && costRollup.total > 0 && (
              <span>ARS {costRollup.spent.toLocaleString()} spent{costRollup.to_spend > 0 ? ` / ${costRollup.to_spend.toLocaleString()} pending` : ""}</span>
            )}
          </div>
        )}
        {/* Monthly breakdown */}
        {timeStats && timeStats.monthly && timeStats.monthly.length > 1 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-gray-500">Monthly</p>
            <div className="flex flex-wrap gap-2">
              {timeStats.monthly.map((m) => (
                <span key={m.month} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                  {m.month}: {Math.round(m.minutes / 60 * 10) / 10}h ({m.entries} entries)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(["journal", "books", "equipment", "images"] as DetailTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setDetailTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              detailTab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-gray-500 hover:text-foreground"
            }`}
          >
            {formatLabel(t)}
          </button>
        ))}
      </div>

      {detailLoading ? <Spinner /> : <>
      {/* JOURNAL TAB */}
      {detailTab === "journal" && (
        <div className="space-y-4">
          <NewEntryForm
            techniqueId={technique.id}
            allBooks={allBooks}
            allEquipment={allEquipment}
            onCreated={fetchEntries}
          />
          {entries.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No journal entries yet. Add your first one above.</p>
          )}
          <div className="space-y-4">
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} onDelete={() => deleteEntry(entry.id)} onUpdated={fetchEntries} />
            ))}
          </div>
        </div>
      )}

      {/* BOOKS TAB */}
      {detailTab === "books" && (
        <div className="space-y-3">
          {linkedBooks.length === 0 && (
            <p className="text-sm text-gray-400">No books linked yet.</p>
          )}
          <div className="space-y-2">
            {linkedBooks.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-sm">
                  {b.title} {b.author && <span className="text-gray-400">by {b.author}</span>}
                </span>
                <button onClick={() => unlinkItem("book", b.id)} className="text-xs text-red-500 hover:text-red-700">
                  Unlink
                </button>
              </div>
            ))}
          </div>
          {unlinkedBooks.length > 0 && (
            <select
              className={inputClass + " !w-auto"}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  linkItem("book", Number(e.target.value));
                  e.target.value = "";
                }
              }}
            >
              <option value="" disabled>Link a book...</option>
              {unlinkedBooks.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* EQUIPMENT TAB */}
      {detailTab === "equipment" && (
        <div className="space-y-3">
          {linkedEquipment.length === 0 && (
            <p className="text-sm text-gray-400">No equipment linked yet.</p>
          )}
          <div className="space-y-2">
            {linkedEquipment.map((eq) => (
              <div key={eq.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-sm">{eq.name}</span>
                <button onClick={() => unlinkItem("equipment", eq.id)} className="text-xs text-red-500 hover:text-red-700">
                  Unlink
                </button>
              </div>
            ))}
          </div>
          {unlinkedEquipment.length > 0 && (
            <select
              className={inputClass + " !w-auto"}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  linkItem("equipment", Number(e.target.value));
                  e.target.value = "";
                }
              }}
            >
              <option value="" disabled>Link equipment...</option>
              {unlinkedEquipment.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* IMAGES TAB */}
      {detailTab === "images" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.url}
                  alt={img.original_name}
                  className="w-full h-40 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                />
                <button
                  onClick={() => deleteImage(img.id)}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  X
                </button>
                <p className="text-xs text-gray-400 mt-1 truncate">{img.original_name}</p>
              </div>
            ))}
          </div>
          {images.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No images yet.</p>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                uploadImage(file);
                e.target.value = "";
              }
            }}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className={btnSecondary}
          >
            Upload Image
          </button>
        </div>
      )}
      </>}
      {confirmDetailDialog()}
    </div>
  );
}

/* ---- New Entry Form ---- */

function NewEntryForm({
  techniqueId,
  allBooks,
  allEquipment,
  onCreated,
}: {
  techniqueId: number;
  allBooks: Book[];
  allEquipment: Equipment[];
  onCreated: () => void;
}) {
  const [text, setText] = useState("");
  const [minutesSpent, setMinutesSpent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [selectedBookIds, setSelectedBookIds] = useState<number[]>([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && files.length === 0) return;
    setSubmitting(true);
    const formData = new FormData();
    formData.append("techniqueId", String(techniqueId));
    formData.append("text", text);
    if (minutesSpent) formData.append("minutesSpent", minutesSpent);
    if (selectedBookIds.length > 0) {
      formData.append("bookIds", JSON.stringify(selectedBookIds));
    }
    if (selectedEquipmentIds.length > 0) {
      formData.append("equipmentIds", JSON.stringify(selectedEquipmentIds));
    }
    for (const file of files) {
      formData.append("files", file);
    }
    await fetch("/api/techniques/entries", { method: "POST", body: formData });
    setText("");
    setMinutesSpent("");
    setFiles([]);
    setSelectedBookIds([]);
    setSelectedEquipmentIds([]);
    setSubmitting(false);
    onCreated();
  }

  function toggleBook(id: number) {
    setSelectedBookIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleEquipment(id: number) {
    setSelectedEquipmentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form onSubmit={submit} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
      <textarea
        className={inputClass}
        placeholder="What did you work on? How did it go?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      <input
        className={inputClass + " !w-32"}
        type="number"
        min="0"
        placeholder="Minutes spent"
        value={minutesSpent}
        onChange={(e) => setMinutesSpent(e.target.value)}
      />

      {/* Image previews */}
      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {files.map((file, i) => (
            <div key={i} className="relative">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="w-20 h-20 object-cover rounded border border-gray-300 dark:border-gray-600"
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}

      {/* References */}
      <div className="flex flex-wrap gap-4">
        {allBooks.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500">Books referenced</p>
            <div className="flex flex-wrap gap-1.5">
              {allBooks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBook(b.id)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    selectedBookIds.includes(b.id)
                      ? "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200"
                      : "border-gray-300 dark:border-gray-600 text-gray-500 hover:border-gray-400"
                  }`}
                >
                  {b.title}
                </button>
              ))}
            </div>
          </div>
        )}
        {allEquipment.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500">Equipment used</p>
            <div className="flex flex-wrap gap-1.5">
              {allEquipment.map((eq) => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => toggleEquipment(eq.id)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    selectedEquipmentIds.includes(eq.id)
                      ? "bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900 dark:border-orange-700 dark:text-orange-200"
                      : "border-gray-300 dark:border-gray-600 text-gray-500 hover:border-gray-400"
                  }`}
                >
                  {eq.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 items-center">
        <button type="submit" disabled={submitting} className={btnPrimary}>
          {submitting ? "Saving..." : "Add Entry"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
              e.target.value = "";
            }
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} className={btnSecondary}>
          Attach Images
        </button>
      </div>
    </form>
  );
}

/* ---- Entry Card ---- */

function EntryCard({ entry, onDelete, onUpdated }: { entry: Entry; onDelete: () => void; onUpdated: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [text, setText] = useState(entry.text);
  const [savingText, setSavingText] = useState(false);
  const { confirm: confirmImg, dialog: confirmImgDialog } = useConfirm();

  const date = new Date(entry.created_at + "Z");
  const dateStr = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  async function attachImages(files: FileList) {
    setUploading(true);
    const formData = new FormData();
    formData.append("entryId", String(entry.id));
    for (const file of Array.from(files)) {
      formData.append("files", file);
    }
    await fetch("/api/techniques/entries/images", { method: "POST", body: formData });
    setUploading(false);
    onUpdated();
  }

  async function removeImage(imageId: number) {
    if (!await confirmImg("Delete this image?")) return;
    await fetch(`/api/techniques/entries/images?id=${imageId}`, { method: "DELETE" });
    onUpdated();
  }

  async function saveText() {
    setSavingText(true);
    await fetch("/api/techniques/entries/text", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, text }),
    });
    setSavingText(false);
    setEditingText(false);
    onUpdated();
  }

  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <time className="text-xs text-gray-400">{dateStr}</time>
          {entry.minutes_spent != null && entry.minutes_spent > 0 && (
            <span className="text-xs text-gray-400">{entry.minutes_spent}min</span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditingText(!editingText)} className="text-xs text-gray-500 hover:text-foreground">
            {editingText ? "Cancel" : "Edit"}
          </button>
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">
            Delete
          </button>
        </div>
      </div>

      {editingText ? (
        <div className="space-y-2">
          <textarea
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            disabled={savingText}
          />
          <button onClick={saveText} disabled={savingText} className={btnPrimary + " text-xs !px-3 !py-1.5"}>
            {savingText ? "Saving..." : "Save"}
          </button>
        </div>
      ) : (
        entry.text && <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
      )}

      {entry.images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {entry.images.map((img) => (
            <div key={img.id} className="relative group">
              <img
                src={img.url}
                alt={img.original_name}
                className="w-full h-40 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}

      {(entry.books.length > 0 || entry.equipment.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {entry.books.map((b) => (
            <span
              key={b.id}
              className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {b.title}
            </span>
          ))}
          {entry.equipment.map((eq) => (
            <span
              key={eq.id}
              className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
            >
              {eq.name}
            </span>
          ))}
        </div>
      )}

      {/* Attach images to existing entry */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              attachImages(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="text-xs px-2 py-1 text-gray-500 hover:text-foreground border border-gray-300 dark:border-gray-600 rounded"
        >
          {uploading ? "Uploading..." : "Attach Images"}
        </button>
      </div>
      {confirmImgDialog()}
    </div>
  );
}

/* ================================================================
   TECHNIQUE LIST & FORM
   ================================================================ */

function TechniqueForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Technique["difficulty"]>("beginner");
  const [status, setStatus] = useState<Technique["status"]>("want_to_learn");
  const [category, setCategory] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/techniques", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, difficulty, status, category }),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
      <input className={inputClass} placeholder="Technique name" value={name} onChange={(e) => setName(e.target.value)} required />
      <textarea className={inputClass} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <input className={inputClass} placeholder="Category (e.g. soldering, finishing)" value={category} onChange={(e) => setCategory(e.target.value)} />
      <div className="flex gap-3">
        <select className={inputClass + " !w-auto"} value={difficulty} onChange={(e) => setDifficulty(e.target.value as Technique["difficulty"])}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <select className={inputClass + " !w-auto"} value={status} onChange={(e) => setStatus(e.target.value as Technique["status"])}>
          <option value="want_to_learn">Want to Learn</option>
          <option value="learning">Learning</option>
          <option value="mastered">Mastered</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary}>Add</button>
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </form>
  );
}

function TechniqueList({
  items,
  onOpen,
  onEdit,
  onDelete,
}: {
  items: Technique[];
  onOpen: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [filterCat, setFilterCat] = useState<string>("");
  const categories = [...new Set(items.map((t) => t.category).filter(Boolean))];
  const filtered = filterCat ? items.filter((t) => t.category === filterCat) : items;

  if (items.length === 0) return <EmptyState label="techniques" />;
  return (
    <div className="space-y-3">
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterCat("")}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${!filterCat ? "bg-foreground text-background border-foreground" : "border-gray-300 dark:border-gray-600 text-gray-500"}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(filterCat === c ? "" : c)}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${filterCat === c ? "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900 dark:border-purple-700 dark:text-purple-200" : "border-gray-300 dark:border-gray-600 text-gray-500"}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {filtered.map((t) => (
          <div
            key={t.id}
            onClick={() => onOpen(t.id)}
            className="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            <div className="space-y-1">
              <div className="font-medium">{t.name}</div>
              {t.description && <div className="text-sm text-gray-500 dark:text-gray-400">{t.description}</div>}
              <div className="flex flex-wrap gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[t.difficulty]}`}>
                  {formatLabel(t.difficulty)}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}>
                  {formatLabel(t.status)}
                </span>
                {t.category && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    {t.category}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1 shrink-0 ml-4">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(t.id); }}
                className="text-xs px-2 py-1 text-gray-500 hover:text-foreground"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                className="text-xs px-2 py-1 text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   EQUIPMENT — inline editing
   ================================================================ */

function EquipmentForm({
  item,
  onDone,
  onCancel,
}: {
  item?: Equipment;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [description, setDescription] = useState(item?.description || "");
  const [priority, setPriority] = useState(item?.priority || "medium");
  const [purchased, setPurchased] = useState(!!item?.purchased);
  const [url, setUrl] = useState(item?.url || "");
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const method = item ? "PUT" : "POST";
    await fetch("/api/equipment", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item?.id, name, description, priority, purchased, url, price: price ? Number(price) : null }),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 border border-blue-300 dark:border-blue-700 rounded-lg space-y-3 bg-blue-50/30 dark:bg-blue-950/20">
      <input className={inputClass} placeholder="Equipment name" value={name} onChange={(e) => setName(e.target.value)} required />
      <textarea className={inputClass} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <input className={inputClass} placeholder="Link to buy (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <input className={inputClass + " !w-40"} type="number" min="0" step="0.01" placeholder="Price (ARS)" value={price} onChange={(e) => setPrice(e.target.value)} />
      <div className="flex gap-3 items-center">
        <select className={inputClass + " !w-auto"} value={priority} onChange={(e) => setPriority(e.target.value as Equipment["priority"])}>
          <option value="low">Low Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={purchased} onChange={(e) => setPurchased(e.target.checked)} className="rounded" />
          Purchased
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary}>{item ? "Update" : "Add"}</button>
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </form>
  );
}

function EquipmentList({
  items,
  editingId,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onTogglePurchased,
}: {
  items: Equipment[];
  editingId: number | null;
  onEdit: (id: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (id: number) => void;
  onTogglePurchased: (item: Equipment) => void;
}) {
  if (items.length === 0) return <EmptyState label="equipment" />;
  return (
    <div className="space-y-2">
      {items.map((e) =>
        editingId === e.id ? (
          <EquipmentForm key={e.id} item={e} onDone={onSaveEdit} onCancel={onCancelEdit} />
        ) : (
          <div
            key={e.id}
            className={`flex items-start justify-between p-4 border rounded-lg ${
              e.purchased
                ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onTogglePurchased(e)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs transition-colors ${
                    e.purchased
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-gray-400 hover:border-green-500"
                  }`}
                >
                  {e.purchased ? "\u2713" : ""}
                </button>
                <span className={`font-medium ${e.purchased ? "line-through text-gray-400" : ""}`}>
                  {e.name}
                </span>
              </div>
              {e.description && (
                <div className="text-sm text-gray-500 dark:text-gray-400 ml-7">{e.description}</div>
              )}
              {e.url && (
                <div className="ml-7">
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                    Buy link
                  </a>
                </div>
              )}
              <div className="ml-7 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[e.priority]}`}>
                  {formatLabel(e.priority)} Priority
                </span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0 ml-4">
              <button onClick={() => onEdit(e.id)} className="text-xs px-2 py-1 text-gray-500 hover:text-foreground">Edit</button>
              <button onClick={() => onDelete(e.id)} className="text-xs px-2 py-1 text-red-500 hover:text-red-700">Delete</button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* ================================================================
   BOOKS — inline editing
   ================================================================ */

function BookForm({
  book,
  onDone,
  onCancel,
}: {
  book?: Book;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(book?.title || "");
  const [author, setAuthor] = useState(book?.author || "");
  const [description, setDescription] = useState(book?.description || "");
  const [status, setStatus] = useState(book?.status || "want_to_read");
  const [url, setUrl] = useState(book?.url || "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const method = book ? "PUT" : "POST";
    await fetch("/api/books", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: book?.id, title, author, description, status, url }),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 border border-blue-300 dark:border-blue-700 rounded-lg space-y-3 bg-blue-50/30 dark:bg-blue-950/20">
      <input className={inputClass} placeholder="Book title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input className={inputClass} placeholder="Author (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} />
      <textarea className={inputClass} placeholder="Notes (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <input className={inputClass} placeholder="Link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <select className={inputClass + " !w-auto"} value={status} onChange={(e) => setStatus(e.target.value as Book["status"])}>
        <option value="want_to_read">Want to Read</option>
        <option value="reading">Reading</option>
        <option value="read">Read</option>
      </select>
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary}>{book ? "Update" : "Add"}</button>
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </form>
  );
}

function BookList({
  items,
  editingId,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  items: Book[];
  editingId: number | null;
  onEdit: (id: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (id: number) => void;
}) {
  if (items.length === 0) return <EmptyState label="books" />;
  return (
    <div className="space-y-2">
      {items.map((b) =>
        editingId === b.id ? (
          <BookForm key={b.id} book={b} onDone={onSaveEdit} onCancel={onCancelEdit} />
        ) : (
          <div key={b.id} className="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="space-y-1">
              <div className="font-medium">{b.title}</div>
              {b.author && <div className="text-sm text-gray-500 dark:text-gray-400">by {b.author}</div>}
              {b.description && <div className="text-sm text-gray-500 dark:text-gray-400">{b.description}</div>}
              <div className="mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${BOOK_STATUS_COLORS[b.status]}`}>
                  {formatLabel(b.status)}
                </span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0 ml-4">
              <button onClick={() => onEdit(b.id)} className="text-xs px-2 py-1 text-gray-500 hover:text-foreground">Edit</button>
              <button onClick={() => onDelete(b.id)} className="text-xs px-2 py-1 text-red-500 hover:text-red-700">Delete</button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* ================================================================
   PROJECTS
   ================================================================ */

function EditProjectModal({
  project,
  onSave,
  onClose,
}: {
  project: Project;
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [status, setStatus] = useState(project.status);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/projects", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: project.id, name, description, status }),
    });
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-lg bg-background border border-gray-200 dark:border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Edit Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input className={inputClass} placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required disabled={saving} />
          <textarea className={inputClass} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={saving} />
          <select className={inputClass + " !w-auto"} value={status} onChange={(e) => setStatus(e.target.value as Project["status"])} disabled={saving}>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className={btnPrimary}>{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={onClose} disabled={saving} className={btnSecondary}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ProjectDetailTab = "entries" | "techniques" | "books" | "equipment" | "images";

function ProjectDetail({
  project,
  allTechniques,
  allBooks,
  allEquipment,
  onBack,
  onEdit,
}: {
  project: Project;
  allTechniques: Technique[];
  allBooks: Book[];
  allEquipment: Equipment[];
  onBack: () => void;
  onEdit: () => void;
}) {
  const [detailTab, setDetailTab] = useState<ProjectDetailTab>("entries");
  const [entries, setEntries] = useState<ProjectEntry[]>([]);
  const [linkedTechniques, setLinkedTechniques] = useState<Technique[]>([]);
  const [linkedBooks, setLinkedBooks] = useState<Book[]>([]);
  const [linkedEquipment, setLinkedEquipment] = useState<Equipment[]>([]);
  const [costRollup, setCostRollup] = useState<CostRollup | null>(null);
  const [images, setImages] = useState<EntryImage[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fetchEntries = useCallback(() => {
    return fetch(`/api/projects/entries?projectId=${project.id}`)
      .then((r) => r.json())
      .then(setEntries);
  }, [project.id]);

  const fetchLinks = useCallback(() => {
    return fetch(`/api/projects/links?projectId=${project.id}`)
      .then((r) => r.json())
      .then((data) => {
        setLinkedTechniques(data.techniques);
        setLinkedBooks(data.books);
        setLinkedEquipment(data.equipment);
        if (data.cost) setCostRollup(data.cost);
      });
  }, [project.id]);

  const fetchImages = useCallback(() => {
    return fetch(`/api/projects/images?projectId=${project.id}`)
      .then((r) => r.json())
      .then(setImages);
  }, [project.id]);

  useEffect(() => {
    Promise.all([fetchEntries(), fetchLinks(), fetchImages()]).then(() => setDetailLoading(false));
  }, [fetchEntries, fetchLinks, fetchImages]);

  async function linkItem(type: "technique" | "book" | "equipment", targetId: number) {
    await fetch("/api/projects/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, type, targetId }),
    });
    fetchLinks();
  }

  async function unlinkItem(type: "technique" | "book" | "equipment", targetId: number) {
    await fetch(
      `/api/projects/links?projectId=${project.id}&type=${type}&targetId=${targetId}`,
      { method: "DELETE" }
    );
    fetchLinks();
  }

  const { confirm: confirmDetail, dialog: confirmDetailDialog } = useConfirm();

  async function deleteEntry(entryId: number) {
    if (!await confirmDetail("Delete this project entry?")) return;
    await fetch(`/api/projects/entries?id=${entryId}`, { method: "DELETE" });
    fetchEntries();
  }

  async function uploadProjectImage(file: File) {
    const formData = new FormData();
    formData.append("projectId", String(project.id));
    formData.append("file", file);
    await fetch("/api/projects/images", { method: "POST", body: formData });
    fetchImages();
  }

  async function deleteProjectImage(imageId: number) {
    if (!await confirmDetail("Delete this image?")) return;
    await fetch(`/api/projects/images?id=${imageId}`, { method: "DELETE" });
    fetchImages();
  }

  const unlinkedTechniques = allTechniques.filter((t) => !linkedTechniques.some((lt) => lt.id === t.id));
  const unlinkedBooks = allBooks.filter((b) => !linkedBooks.some((lb) => lb.id === b.id));
  const unlinkedEquipment = allEquipment.filter((eq) => !linkedEquipment.some((le) => le.id === eq.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-foreground">
          &larr; Back
        </button>
        <button onClick={onEdit} className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-500 hover:text-foreground hover:border-gray-400">
          Edit
        </button>
      </div>

      <div>
        <h2 className="text-xl font-bold">{project.name}</h2>
        {project.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{project.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${PROJECT_STATUS_COLORS[project.status]}`}>
            {formatLabel(project.status)}
          </span>
        </div>
        {!detailLoading && costRollup && costRollup.total > 0 && (
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
            <span>ARS {costRollup.spent.toLocaleString()} spent{costRollup.to_spend > 0 ? ` / ${costRollup.to_spend.toLocaleString()} pending` : ""}</span>
          </div>
        )}
      </div>

      {/* Detail tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
        {(["entries", "techniques", "books", "equipment", "images"] as ProjectDetailTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setDetailTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              detailTab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-gray-500 hover:text-foreground"
            }`}
          >
            {formatLabel(t)}
          </button>
        ))}
      </div>

      {detailLoading ? <Spinner /> : <>
      {/* ENTRIES TAB */}
      {detailTab === "entries" && (
        <div className="space-y-4">
          <NewProjectEntryForm projectId={project.id} onCreated={fetchEntries} />
          {entries.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No entries yet. Add your first one above.</p>
          )}
          <div className="space-y-4">
            {entries.map((entry) => (
              <ProjectEntryCard key={entry.id} entry={entry} onDelete={() => deleteEntry(entry.id)} onUpdated={fetchEntries} />
            ))}
          </div>
        </div>
      )}

      {/* TECHNIQUES TAB */}
      {detailTab === "techniques" && (
        <div className="space-y-3">
          {linkedTechniques.length === 0 && (
            <p className="text-sm text-gray-400">No techniques linked yet.</p>
          )}
          <div className="space-y-2">
            {linkedTechniques.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="space-y-1">
                  <span className="text-sm font-medium">{t.name}</span>
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}>
                      {formatLabel(t.status)}
                    </span>
                  </div>
                </div>
                <button onClick={() => unlinkItem("technique", t.id)} className="text-xs text-red-500 hover:text-red-700">
                  Unlink
                </button>
              </div>
            ))}
          </div>
          {unlinkedTechniques.length > 0 && (
            <select
              className={inputClass + " !w-auto"}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  linkItem("technique", Number(e.target.value));
                  e.target.value = "";
                }
              }}
            >
              <option value="" disabled>Link a technique...</option>
              {unlinkedTechniques.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* BOOKS TAB */}
      {detailTab === "books" && (
        <div className="space-y-3">
          {linkedBooks.length === 0 && (
            <p className="text-sm text-gray-400">No books linked yet.</p>
          )}
          <div className="space-y-2">
            {linkedBooks.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-sm">
                  {b.title} {b.author && <span className="text-gray-400">by {b.author}</span>}
                </span>
                <button onClick={() => unlinkItem("book", b.id)} className="text-xs text-red-500 hover:text-red-700">
                  Unlink
                </button>
              </div>
            ))}
          </div>
          {unlinkedBooks.length > 0 && (
            <select
              className={inputClass + " !w-auto"}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  linkItem("book", Number(e.target.value));
                  e.target.value = "";
                }
              }}
            >
              <option value="" disabled>Link a book...</option>
              {unlinkedBooks.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* EQUIPMENT TAB */}
      {detailTab === "equipment" && (
        <div className="space-y-3">
          {linkedEquipment.length === 0 && (
            <p className="text-sm text-gray-400">No equipment linked yet.</p>
          )}
          <div className="space-y-2">
            {linkedEquipment.map((eq) => (
              <div key={eq.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="text-sm">{eq.name}</span>
                <button onClick={() => unlinkItem("equipment", eq.id)} className="text-xs text-red-500 hover:text-red-700">
                  Unlink
                </button>
              </div>
            ))}
          </div>
          {unlinkedEquipment.length > 0 && (
            <select
              className={inputClass + " !w-auto"}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  linkItem("equipment", Number(e.target.value));
                  e.target.value = "";
                }
              }}
            >
              <option value="" disabled>Link equipment...</option>
              {unlinkedEquipment.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* IMAGES TAB */}
      {detailTab === "images" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.url}
                  alt={img.original_name}
                  className="w-full h-40 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                />
                <button
                  onClick={() => deleteProjectImage(img.id)}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  X
                </button>
                <p className="text-xs text-gray-400 mt-1 truncate">{img.original_name}</p>
              </div>
            ))}
          </div>
          {images.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No images yet.</p>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                uploadProjectImage(file);
                e.target.value = "";
              }
            }}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className={btnSecondary}
          >
            Upload Image
          </button>
        </div>
      )}
      </>}
      {confirmDetailDialog()}
    </div>
  );
}

function NewProjectEntryForm({
  projectId,
  onCreated,
}: {
  projectId: number;
  onCreated: () => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && files.length === 0) return;
    setSubmitting(true);
    const formData = new FormData();
    formData.append("projectId", String(projectId));
    formData.append("text", text);
    for (const file of files) {
      formData.append("files", file);
    }
    await fetch("/api/projects/entries", { method: "POST", body: formData });
    setText("");
    setFiles([]);
    setSubmitting(false);
    onCreated();
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form onSubmit={submit} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
      <textarea
        className={inputClass}
        placeholder="What did you work on? How did it go?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {files.map((file, i) => (
            <div key={i} className="relative">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="w-20 h-20 object-cover rounded border border-gray-300 dark:border-gray-600"
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-center">
        <button type="submit" disabled={submitting} className={btnPrimary}>
          {submitting ? "Saving..." : "Add Entry"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
              e.target.value = "";
            }
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} className={btnSecondary}>
          Attach Images
        </button>
      </div>
    </form>
  );
}

function ProjectEntryCard({ entry, onDelete, onUpdated }: { entry: ProjectEntry; onDelete: () => void; onUpdated: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [text, setText] = useState(entry.text);
  const [savingText, setSavingText] = useState(false);
  const { confirm: confirmImg, dialog: confirmImgDialog } = useConfirm();

  const date = new Date(entry.created_at + "Z");
  const dateStr = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  async function attachImages(files: FileList) {
    setUploading(true);
    const formData = new FormData();
    formData.append("entryId", String(entry.id));
    for (const file of Array.from(files)) {
      formData.append("files", file);
    }
    await fetch("/api/projects/entries/images", { method: "POST", body: formData });
    setUploading(false);
    onUpdated();
  }

  async function removeImage(imageId: number) {
    if (!await confirmImg("Delete this image?")) return;
    await fetch(`/api/projects/entries/images?id=${imageId}`, { method: "DELETE" });
    onUpdated();
  }

  async function saveText() {
    setSavingText(true);
    await fetch("/api/projects/entries/text", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, text }),
    });
    setSavingText(false);
    setEditingText(false);
    onUpdated();
  }

  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
      <div className="flex items-start justify-between">
        <time className="text-xs text-gray-400">{dateStr}</time>
        <div className="flex gap-2">
          <button onClick={() => setEditingText(!editingText)} className="text-xs text-gray-500 hover:text-foreground">
            {editingText ? "Cancel" : "Edit"}
          </button>
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">
            Delete
          </button>
        </div>
      </div>

      {editingText ? (
        <div className="space-y-2">
          <textarea
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            disabled={savingText}
          />
          <button onClick={saveText} disabled={savingText} className={btnPrimary + " text-xs !px-3 !py-1.5"}>
            {savingText ? "Saving..." : "Save"}
          </button>
        </div>
      ) : (
        entry.text && <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
      )}

      {entry.images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {entry.images.map((img) => (
            <div key={img.id} className="relative group">
              <img
                src={img.url}
                alt={img.original_name}
                className="w-full h-40 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              attachImages(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="text-xs px-2 py-1 text-gray-500 hover:text-foreground border border-gray-300 dark:border-gray-600 rounded"
        >
          {uploading ? "Uploading..." : "Attach Images"}
        </button>
      </div>
      {confirmImgDialog()}
    </div>
  );
}

function ProjectForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Project["status"]>("planned");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, status }),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
      <input className={inputClass} placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
      <textarea className={inputClass} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <select className={inputClass + " !w-auto"} value={status} onChange={(e) => setStatus(e.target.value as Project["status"])}>
        <option value="planned">Planned</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
      </select>
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary}>Add</button>
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </form>
  );
}

function ProjectList({
  items,
  onOpen,
  onEdit,
  onDelete,
}: {
  items: Project[];
  onOpen: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const statuses = [...new Set(items.map((p) => p.status))];
  const filtered = filterStatus ? items.filter((p) => p.status === filterStatus) : items;

  if (items.length === 0) return <EmptyState label="projects" />;
  return (
    <div className="space-y-3">
      {statuses.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterStatus("")}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${!filterStatus ? "bg-foreground text-background border-foreground" : "border-gray-300 dark:border-gray-600 text-gray-500"}`}
          >
            All
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${filterStatus === s ? PROJECT_STATUS_COLORS[s] + " border-current" : "border-gray-300 dark:border-gray-600 text-gray-500"}`}
            >
              {formatLabel(s)}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {filtered.map((p) => (
          <div
            key={p.id}
            onClick={() => onOpen(p.id)}
            className="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            <div className="space-y-1">
              <div className="font-medium">{p.name}</div>
              {p.description && <div className="text-sm text-gray-500 dark:text-gray-400">{p.description}</div>}
              <div className="flex flex-wrap gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${PROJECT_STATUS_COLORS[p.status]}`}>
                  {formatLabel(p.status)}
                </span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0 ml-4">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(p.id); }}
                className="text-xs px-2 py-1 text-gray-500 hover:text-foreground"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                className="text-xs px-2 py-1 text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   ACCOUNTING — Treasury View
   ================================================================ */

function TreasuryView({ treasury }: { treasury: Treasury | null }) {
  const [months, setMonths] = useState("");

  if (!treasury) return <p className="text-sm text-gray-400 text-center py-12">No accounting data yet.</p>;

  const m = Number(months);
  const deficitArs = treasury.net_ars < 0 ? Math.abs(treasury.net_ars) : 0;
  const deficitUsd = treasury.net_usd < 0 ? Math.abs(treasury.net_usd) : 0;
  const targetArs = m > 0 && deficitArs > 0 ? Math.ceil(deficitArs / m) : 0;
  const targetUsd = m > 0 && deficitUsd > 0 ? Math.ceil(deficitUsd / m) : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Expenses</p>
          <p className="text-lg font-bold mt-1">ARS {treasury.expenses_ars.toLocaleString()}</p>
          {treasury.expenses_usd > 0 && <p className="text-sm text-gray-500">USD {treasury.expenses_usd.toLocaleString()}</p>}
        </div>
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sales</p>
          <p className="text-lg font-bold mt-1">ARS {treasury.sales_ars.toLocaleString()}</p>
          {treasury.sales_usd > 0 && <p className="text-sm text-gray-500">USD {treasury.sales_usd.toLocaleString()}</p>}
        </div>
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Net Balance</p>
          <p className={`text-lg font-bold mt-1 ${treasury.net_ars >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            ARS {treasury.net_ars.toLocaleString()}
          </p>
          {(treasury.net_usd !== 0) && (
            <p className={`text-sm ${treasury.net_usd >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              USD {treasury.net_usd.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Break-even calculator */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide">Break-Even Calculator</p>
        {deficitArs === 0 && deficitUsd === 0 ? (
          <p className="text-sm text-emerald-600 font-medium">You&apos;ve already broken even!</p>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              You need to recover{" "}
              {deficitArs > 0 && <span className="font-medium">ARS {deficitArs.toLocaleString()}</span>}
              {deficitArs > 0 && deficitUsd > 0 && " and "}
              {deficitUsd > 0 && <span className="font-medium">USD {deficitUsd.toLocaleString()}</span>}
              . Over how many months?
            </p>
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Months</label>
                <input
                  className={inputClass + " !w-24"}
                  type="number"
                  min="1"
                  placeholder="e.g. 6"
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                />
              </div>
              {m > 0 && (
                <div className="text-sm pb-2 space-y-0.5">
                  {targetArs > 0 && <p>Sell <span className="font-medium text-foreground">ARS {targetArs.toLocaleString()}/mo</span></p>}
                  {targetUsd > 0 && <p>Sell <span className="font-medium text-foreground">USD {targetUsd.toLocaleString()}/mo</span></p>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   ACCOUNTING — Expenses
   ================================================================ */

function ExpenseForm({
  item,
  onDone,
  onCancel,
}: {
  item?: Expense;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState(item?.description || "");
  const [amount, setAmount] = useState(item?.amount != null ? String(item.amount) : "");
  const [currency, setCurrency] = useState(item?.currency || "ARS");
  const [category, setCategory] = useState(item?.category || "materials");
  const [date, setDate] = useState(item?.date || new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState(item?.notes || "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const method = item ? "PUT" : "POST";
    await fetch("/api/expenses", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item?.id, description, amount: Number(amount), currency, category, date, notes }),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 border border-blue-300 dark:border-blue-700 rounded-lg space-y-3 bg-blue-50/30 dark:bg-blue-950/20">
      <input className={inputClass} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required />
      <div className="flex gap-3">
        <input className={inputClass + " !w-32"} type="number" min="0" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <select className={inputClass + " !w-auto"} value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
        <select className={inputClass + " !w-auto"} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="materials">Materials</option>
          <option value="tools">Tools</option>
          <option value="courses">Courses</option>
          <option value="shipping">Shipping</option>
          <option value="packaging">Packaging</option>
          <option value="other">Other</option>
        </select>
      </div>
      <input className={inputClass + " !w-auto"} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <textarea className={inputClass} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary}>{item ? "Update" : "Add"}</button>
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </form>
  );
}

function ExpenseList({
  items,
  editingId,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  items: Expense[];
  editingId: number | null;
  onEdit: (id: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (id: number) => void;
}) {
  if (items.length === 0) return <EmptyState label="expenses" />;
  return (
    <div className="space-y-2">
      {items.map((exp) =>
        editingId === exp.id ? (
          <ExpenseForm key={exp.id} item={exp} onDone={onSaveEdit} onCancel={onCancelEdit} />
        ) : (
          <div key={exp.id} className="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="space-y-1">
              <div className="font-medium">{exp.description}</div>
              <div className="text-sm font-mono">{exp.currency} {exp.amount.toLocaleString()}</div>
              {exp.notes && <div className="text-sm text-gray-500 dark:text-gray-400">{exp.notes}</div>}
              <div className="flex flex-wrap gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${EXPENSE_CATEGORY_COLORS[exp.category] || EXPENSE_CATEGORY_COLORS.other}`}>
                  {formatLabel(exp.category)}
                </span>
                <span className="text-xs text-gray-400">{exp.date}</span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0 ml-4">
              <button onClick={() => onEdit(exp.id)} className="text-xs px-2 py-1 text-gray-500 hover:text-foreground">Edit</button>
              <button onClick={() => onDelete(exp.id)} className="text-xs px-2 py-1 text-red-500 hover:text-red-700">Delete</button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* ================================================================
   ACCOUNTING — Sales
   ================================================================ */

function SaleForm({
  item,
  products,
  onDone,
  onCancel,
}: {
  item?: Sale;
  products: Product[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState(item?.description || "");
  const [amount, setAmount] = useState(item?.amount != null ? String(item.amount) : "");
  const [currency, setCurrency] = useState(item?.currency || "ARS");
  const [productId, setProductId] = useState<string>(item?.product_id != null ? String(item.product_id) : "");
  const [customer, setCustomer] = useState(item?.customer || "");
  const [notes, setNotes] = useState(item?.notes || "");
  const [date, setDate] = useState(item?.date || new Date().toISOString().split("T")[0]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const method = item ? "PUT" : "POST";
    await fetch("/api/sales", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item?.id,
        description,
        amount: Number(amount),
        currency,
        product_id: productId ? Number(productId) : null,
        customer,
        notes,
        date,
      }),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 border border-blue-300 dark:border-blue-700 rounded-lg space-y-3 bg-blue-50/30 dark:bg-blue-950/20">
      <input className={inputClass} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required />
      <div className="flex gap-3">
        <input className={inputClass + " !w-32"} type="number" min="0" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <select className={inputClass + " !w-auto"} value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <select className={inputClass + " !w-auto"} value={productId} onChange={(e) => setProductId(e.target.value)}>
        <option value="">No product linked</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <input className={inputClass} placeholder="Customer (optional)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
      <input className={inputClass + " !w-auto"} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <textarea className={inputClass} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary}>{item ? "Update" : "Add"}</button>
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </form>
  );
}

function SaleList({
  items,
  editingId,
  products,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  items: Sale[];
  editingId: number | null;
  products: Product[];
  onEdit: (id: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (id: number) => void;
}) {
  if (items.length === 0) return <EmptyState label="sales" />;
  return (
    <div className="space-y-2">
      {items.map((sale) =>
        editingId === sale.id ? (
          <SaleForm key={sale.id} item={sale} products={products} onDone={onSaveEdit} onCancel={onCancelEdit} />
        ) : (
          <div key={sale.id} className="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="space-y-1">
              <div className="font-medium">{sale.description}</div>
              <div className="text-sm font-mono">{sale.currency} {sale.amount.toLocaleString()}</div>
              {sale.product_name && (
                <div className="text-sm text-gray-500 dark:text-gray-400">Product: {sale.product_name}</div>
              )}
              {sale.customer && (
                <div className="text-sm text-gray-500 dark:text-gray-400">Customer: {sale.customer}</div>
              )}
              {sale.notes && <div className="text-sm text-gray-500 dark:text-gray-400">{sale.notes}</div>}
              <div className="mt-1">
                <span className="text-xs text-gray-400">{sale.date}</span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0 ml-4">
              <button onClick={() => onEdit(sale.id)} className="text-xs px-2 py-1 text-gray-500 hover:text-foreground">Edit</button>
              <button onClick={() => onDelete(sale.id)} className="text-xs px-2 py-1 text-red-500 hover:text-red-700">Delete</button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* ================================================================
   ACCOUNTING — Products
   ================================================================ */

function ProductForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [materials, setMaterials] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [status, setStatus] = useState<Product["status"]>("in_progress");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, materials, currency, status }),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
      <input className={inputClass} placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} required />
      <textarea className={inputClass} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <textarea className={inputClass} placeholder="Materials used (optional)" value={materials} onChange={(e) => setMaterials(e.target.value)} rows={2} />
      <div className="flex gap-3">
        <select className={inputClass + " !w-auto"} value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
        <select className={inputClass + " !w-auto"} value={status} onChange={(e) => setStatus(e.target.value as Product["status"])}>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="sold">Sold</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary}>Add</button>
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </form>
  );
}

function ProductList({
  items,
  onOpen,
  onEdit,
  onDelete,
}: {
  items: Product[];
  onOpen: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const statuses = [...new Set(items.map((p) => p.status))];
  const filtered = filterStatus ? items.filter((p) => p.status === filterStatus) : items;

  if (items.length === 0) return <EmptyState label="products" />;
  return (
    <div className="space-y-3">
      {statuses.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterStatus("")}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${!filterStatus ? "bg-foreground text-background border-foreground" : "border-gray-300 dark:border-gray-600 text-gray-500"}`}
          >
            All
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${filterStatus === s ? PRODUCT_STATUS_COLORS[s] + " border-current" : "border-gray-300 dark:border-gray-600 text-gray-500"}`}
            >
              {formatLabel(s)}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {filtered.map((p) => (
          <div
            key={p.id}
            onClick={() => onOpen(p.id)}
            className="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            <div className="space-y-1">
              <div className="font-medium">{p.name}</div>
              {p.description && <div className="text-sm text-gray-500 dark:text-gray-400">{p.description}</div>}
              <div className="flex flex-wrap gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${PRODUCT_STATUS_COLORS[p.status]}`}>
                  {formatLabel(p.status)}
                </span>
                <span className="text-xs text-gray-400">{p.currency}</span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0 ml-4">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(p.id); }}
                className="text-xs px-2 py-1 text-gray-500 hover:text-foreground"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                className="text-xs px-2 py-1 text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   ACCOUNTING — Edit Product Modal
   ================================================================ */

function EditProductModal({
  product,
  onSave,
  onClose,
}: {
  product: Product;
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [materials, setMaterials] = useState(product.materials);
  const [currency, setCurrency] = useState(product.currency);
  const [status, setStatus] = useState(product.status);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: product.id, name, description, materials, currency, status }),
    });
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-lg bg-background border border-gray-200 dark:border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Edit Product</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input className={inputClass} placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} required disabled={saving} />
          <textarea className={inputClass} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={saving} />
          <textarea className={inputClass} placeholder="Materials used" value={materials} onChange={(e) => setMaterials(e.target.value)} rows={2} disabled={saving} />
          <div className="flex gap-3">
            <select className={inputClass + " !w-auto"} value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={saving}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
            <select className={inputClass + " !w-auto"} value={status} onChange={(e) => setStatus(e.target.value as Product["status"])} disabled={saving}>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="sold">Sold</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className={btnPrimary}>{saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={onClose} disabled={saving} className={btnSecondary}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================================================================
   ACCOUNTING — Product Detail (work log + images)
   ================================================================ */

type ProductDetailTab = "work_log" | "images";

function ProductDetail({
  product,
  onBack,
  onEdit,
}: {
  product: Product;
  onBack: () => void;
  onEdit: () => void;
}) {
  const [detailTab, setDetailTab] = useState<ProductDetailTab>("work_log");
  const [entries, setEntries] = useState<ProductWorkEntry[]>([]);
  const [images, setImages] = useState<EntryImage[]>([]);
  const [timeStats, setTimeStats] = useState<ProductTimeStats | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fetchEntries = useCallback(() => {
    return fetch(`/api/products/entries?productId=${product.id}`)
      .then((r) => r.json())
      .then(setEntries);
  }, [product.id]);

  const fetchImages = useCallback(() => {
    return fetch(`/api/products/images?productId=${product.id}`)
      .then((r) => r.json())
      .then(setImages);
  }, [product.id]);

  const fetchStats = useCallback(() => {
    return fetch(`/api/products/stats?productId=${product.id}`)
      .then((r) => r.json())
      .then(setTimeStats);
  }, [product.id]);

  useEffect(() => {
    Promise.all([fetchEntries(), fetchImages(), fetchStats()]).then(() => setDetailLoading(false));
  }, [fetchEntries, fetchImages, fetchStats]);

  const { confirm: confirmDetail, dialog: confirmDetailDialog } = useConfirm();

  async function deleteEntry(entryId: number) {
    if (!await confirmDetail("Delete this work entry?")) return;
    await fetch(`/api/products/entries?id=${entryId}`, { method: "DELETE" });
    fetchEntries();
    fetchStats();
  }

  async function uploadImage(file: File) {
    const formData = new FormData();
    formData.append("productId", String(product.id));
    formData.append("file", file);
    await fetch("/api/products/images", { method: "POST", body: formData });
    fetchImages();
  }

  async function deleteImage(imageId: number) {
    if (!await confirmDetail("Delete this image?")) return;
    await fetch(`/api/products/images?id=${imageId}`, { method: "DELETE" });
    fetchImages();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-foreground">
          &larr; Back
        </button>
        <button onClick={onEdit} className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-500 hover:text-foreground hover:border-gray-400">
          Edit
        </button>
      </div>

      <div>
        <h2 className="text-xl font-bold">{product.name}</h2>
        {product.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{product.description}</p>
        )}
        {product.materials && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Materials: {product.materials}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${PRODUCT_STATUS_COLORS[product.status]}`}>
            {formatLabel(product.status)}
          </span>
          <span className="text-xs text-gray-400">{product.currency}</span>
        </div>
        {/* Stats bar */}
        {!detailLoading && timeStats && (
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
            {timeStats.total_minutes > 0 && (
              <span>{Math.round(timeStats.total_minutes / 60 * 10) / 10}h logged</span>
            )}
            {timeStats.total_entry_count > 0 && (
              <span>{timeStats.total_entry_count} entries{timeStats.tracked_entry_count > 0 && timeStats.tracked_entry_count < timeStats.total_entry_count ? ` (${timeStats.tracked_entry_count} tracked)` : ""}</span>
            )}
          </div>
        )}
      </div>

      {/* Detail tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(["work_log", "images"] as ProductDetailTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setDetailTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              detailTab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-gray-500 hover:text-foreground"
            }`}
          >
            {formatLabel(t)}
          </button>
        ))}
      </div>

      {detailLoading ? <Spinner /> : <>
      {/* WORK LOG TAB */}
      {detailTab === "work_log" && (
        <div className="space-y-4">
          <NewProductEntryForm productId={product.id} onCreated={() => { fetchEntries(); fetchStats(); }} />
          {entries.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No work entries yet. Add your first one above.</p>
          )}
          <div className="space-y-4">
            {entries.map((entry) => (
              <ProductWorkEntryCard key={entry.id} entry={entry} onDelete={() => deleteEntry(entry.id)} onUpdated={() => { fetchEntries(); fetchStats(); }} />
            ))}
          </div>
        </div>
      )}

      {/* IMAGES TAB */}
      {detailTab === "images" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.url}
                  alt={img.original_name}
                  className="w-full h-40 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                />
                <button
                  onClick={() => deleteImage(img.id)}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  X
                </button>
                <p className="text-xs text-gray-400 mt-1 truncate">{img.original_name}</p>
              </div>
            ))}
          </div>
          {images.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No images yet.</p>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                uploadImage(file);
                e.target.value = "";
              }
            }}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className={btnSecondary}
          >
            Upload Image
          </button>
        </div>
      )}
      </>}
      {confirmDetailDialog()}
    </div>
  );
}

/* ---- New Product Entry Form ---- */

function NewProductEntryForm({
  productId,
  onCreated,
}: {
  productId: number;
  onCreated: () => void;
}) {
  const [text, setText] = useState("");
  const [minutesSpent, setMinutesSpent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && files.length === 0) return;
    setSubmitting(true);
    const formData = new FormData();
    formData.append("productId", String(productId));
    formData.append("text", text);
    if (minutesSpent) formData.append("minutesSpent", minutesSpent);
    for (const file of files) {
      formData.append("files", file);
    }
    await fetch("/api/products/entries", { method: "POST", body: formData });
    setText("");
    setMinutesSpent("");
    setFiles([]);
    setSubmitting(false);
    onCreated();
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form onSubmit={submit} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
      <textarea
        className={inputClass}
        placeholder="What did you work on?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      <input
        className={inputClass + " !w-32"}
        type="number"
        min="0"
        placeholder="Minutes spent"
        value={minutesSpent}
        onChange={(e) => setMinutesSpent(e.target.value)}
      />
      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {files.map((file, i) => (
            <div key={i} className="relative">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="w-20 h-20 object-cover rounded border border-gray-300 dark:border-gray-600"
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-center">
        <button type="submit" disabled={submitting} className={btnPrimary}>
          {submitting ? "Saving..." : "Add Entry"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
              e.target.value = "";
            }
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} className={btnSecondary}>
          Attach Images
        </button>
      </div>
    </form>
  );
}

/* ---- Product Work Entry Card ---- */

function ProductWorkEntryCard({ entry, onDelete, onUpdated }: { entry: ProductWorkEntry; onDelete: () => void; onUpdated: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [text, setText] = useState(entry.text);
  const [savingText, setSavingText] = useState(false);
  const { confirm: confirmImg, dialog: confirmImgDialog } = useConfirm();

  const date = new Date(entry.created_at + "Z");
  const dateStr = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  async function attachImages(files: FileList) {
    setUploading(true);
    const formData = new FormData();
    formData.append("entryId", String(entry.id));
    for (const file of Array.from(files)) {
      formData.append("files", file);
    }
    await fetch("/api/products/entries/images", { method: "POST", body: formData });
    setUploading(false);
    onUpdated();
  }

  async function removeImage(imageId: number) {
    if (!await confirmImg("Delete this image?")) return;
    await fetch(`/api/products/entries/images?id=${imageId}`, { method: "DELETE" });
    onUpdated();
  }

  async function saveText() {
    setSavingText(true);
    await fetch("/api/products/entries/text", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, text }),
    });
    setSavingText(false);
    setEditingText(false);
    onUpdated();
  }

  return (
    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <time className="text-xs text-gray-400">{dateStr}</time>
          {entry.minutes_spent != null && entry.minutes_spent > 0 && (
            <span className="text-xs text-gray-400">{entry.minutes_spent}min</span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditingText(!editingText)} className="text-xs text-gray-500 hover:text-foreground">
            {editingText ? "Cancel" : "Edit"}
          </button>
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">
            Delete
          </button>
        </div>
      </div>

      {editingText ? (
        <div className="space-y-2">
          <textarea
            className={inputClass}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            disabled={savingText}
          />
          <button onClick={saveText} disabled={savingText} className={btnPrimary + " text-xs !px-3 !py-1.5"}>
            {savingText ? "Saving..." : "Save"}
          </button>
        </div>
      ) : (
        entry.text && <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
      )}

      {entry.images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {entry.images.map((img) => (
            <div key={img.id} className="relative group">
              <img
                src={img.url}
                alt={img.original_name}
                className="w-full h-40 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              attachImages(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="text-xs px-2 py-1 text-gray-500 hover:text-foreground border border-gray-300 dark:border-gray-600 rounded"
        >
          {uploading ? "Uploading..." : "Attach Images"}
        </button>
      </div>
      {confirmImgDialog()}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-12 text-gray-400 dark:text-gray-500">
      No {label} yet. Add your first one above.
    </div>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <div className={`flex justify-center py-12 ${className || ""}`}>
      <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onCancel}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-sm bg-background border border-gray-200 dark:border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className={btnSecondary}>Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function useConfirm() {
  const [state, setState] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null);

  function confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      setState({ message, resolve });
    });
  }

  function dialog() {
    if (!state) return null;
    return (
      <ConfirmDialog
        message={state.message}
        onConfirm={() => { state.resolve(true); setState(null); }}
        onCancel={() => { state.resolve(false); setState(null); }}
      />
    );
  }

  return { confirm, dialog };
}
