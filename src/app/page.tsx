"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Tab = "feed" | "techniques" | "equipment" | "books";

interface Technique {
  id: number;
  name: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  status: "want_to_learn" | "learning" | "mastered";
}

interface Equipment {
  id: number;
  name: string;
  description: string;
  priority: "low" | "medium" | "high";
  purchased: number;
  url: string;
}

interface Book {
  id: number;
  title: string;
  author: string;
  description: string;
  status: "want_to_read" | "reading" | "read";
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
  created_at: string;
  images: EntryImage[];
  books: Book[];
  equipment: Equipment[];
}

interface FeedEntry extends Entry {
  technique_name: string;
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
  const { confirm, dialog: confirmDialog } = useConfirm();

  const fetchAll = useCallback(async () => {
    const [t, e, b, f] = await Promise.all([
      fetch("/api/techniques").then((r) => r.json()),
      fetch("/api/equipment").then((r) => r.json()),
      fetch("/api/books").then((r) => r.json()),
      fetch("/api/entries").then((r) => r.json()),
    ]);
    setTechniques(t);
    setEquipment(e);
    setBooks(b);
    setFeedEntries(f);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Journey</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Techniques, equipment & books
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs - hidden when viewing technique detail */}
        {!isViewingTechnique && (
          <>
            <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
              {(["feed", "techniques", "equipment", "books"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); closeForm(); }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === t
                      ? "border-foreground text-foreground"
                      : "border-transparent text-gray-500 hover:text-foreground"
                  }`}
                >
                  {formatLabel(t)}
                </button>
              ))}
            </div>

            {tab !== "feed" && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => { setShowForm(true); setEditing(null); }}
                  className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  + Add{" "}
                  {tab === "techniques" ? "Technique" : tab === "equipment" ? "Equipment" : "Book"}
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
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/techniques", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: technique.id, name, description, difficulty, status }),
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
  const [detailLoading, setDetailLoading] = useState(true);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fetchLinks = useCallback(() => {
    return fetch(`/api/techniques/links?techniqueId=${technique.id}`)
      .then((r) => r.json())
      .then((data) => {
        setLinkedBooks(data.books);
        setLinkedEquipment(data.equipment);
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

  useEffect(() => {
    Promise.all([fetchLinks(), fetchEntries(), fetchImages()]).then(() => setDetailLoading(false));
  }, [fetchLinks, fetchEntries, fetchImages]);

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
        <div className="flex gap-2 mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[technique.difficulty]}`}>
            {formatLabel(technique.difficulty)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[technique.status]}`}>
            {formatLabel(technique.status)}
          </span>
        </div>
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/techniques", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, difficulty, status }),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
      <input className={inputClass} placeholder="Technique name" value={name} onChange={(e) => setName(e.target.value)} required />
      <textarea className={inputClass} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
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
  if (items.length === 0) return <EmptyState label="techniques" />;
  return (
    <div className="space-y-2">
      {items.map((t) => (
        <div
          key={t.id}
          onClick={() => onOpen(t.id)}
          className="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
        >
          <div className="space-y-1">
            <div className="font-medium">{t.name}</div>
            {t.description && <div className="text-sm text-gray-500 dark:text-gray-400">{t.description}</div>}
            <div className="flex gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[t.difficulty]}`}>
                {formatLabel(t.difficulty)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}>
                {formatLabel(t.status)}
              </span>
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const method = item ? "PUT" : "POST";
    await fetch("/api/equipment", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item?.id, name, description, priority, purchased, url }),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 border border-blue-300 dark:border-blue-700 rounded-lg space-y-3 bg-blue-50/30 dark:bg-blue-950/20">
      <input className={inputClass} placeholder="Equipment name" value={name} onChange={(e) => setName(e.target.value)} required />
      <textarea className={inputClass} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <input className={inputClass} placeholder="Link to buy (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const method = book ? "PUT" : "POST";
    await fetch("/api/books", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: book?.id, title, author, description, status }),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-6 p-4 border border-blue-300 dark:border-blue-700 rounded-lg space-y-3 bg-blue-50/30 dark:bg-blue-950/20">
      <input className={inputClass} placeholder="Book title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input className={inputClass} placeholder="Author (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} />
      <textarea className={inputClass} placeholder="Notes (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
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
