// Builds the presupuesto PDF (Spanish, client-facing) with pdf-lib.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { FullQuote } from "@/lib/workshop";
import type { Section } from "@/lib/quote-engine";

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const M = 48; // margin
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.42, 0.42, 0.42);
const RULE = rgb(0.85, 0.85, 0.85);
const ACCENT = rgb(0.55, 0.42, 0.25);

const SECTION_TITLES: Record<Section, string> = {
  materials: "Materiales",
  labor: "Mano de obra",
  machines: "Uso de máquinas",
  one_time: "Costos únicos (diseño, modelo, molde)",
  other: "Otros",
};
const SECTION_ORDER: Section[] = ["materials", "labor", "machines", "one_time", "other"];
const KIND_SECTION: Record<string, Section> = { material: "materials", labor: "labor", machine: "machines", one_time: "one_time", other: "other" };

export function money(n: number): string {
  return `$ ${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function qtyText(n: number): string {
  return Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function fmtDate(iso: unknown): string {
  if (!iso || typeof iso !== "string") return "";
  const [y, m, d] = iso.substring(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export async function buildQuotePdf(full: FullQuote, settings: Record<string, string>): Promise<Uint8Array> {
  const { quote, lines, breakdown, price_breaks } = full;
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(`Presupuesto ${quote.number}`);
  doc.setAuthor(settings.business_name || "Kata");

  // Keep only characters the standard fonts can encode (WinAnsi).
  const safe = (font: PDFFont, s: string) =>
    [...String(s ?? "")].map((ch) => { try { font.encodeText(ch); return ch; } catch { return ch === "\n" ? "\n" : "?"; } }).join("");

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const newPage = () => { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; };
  const ensure = (h: number) => { if (y - h < M + 30) newPage(); };

  const text = (s: string, x: number, size: number, font = regular, color = INK) => {
    page.drawText(safe(font, s), { x, y, size, font, color });
  };
  const textRight = (s: string, xRight: number, size: number, font = regular, color = INK) => {
    const t = safe(font, s);
    page.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y, size, font, color });
  };
  const wrap = (s: string, width: number, size: number, font = regular): string[] => {
    const out: string[] = [];
    for (const para of safe(font, s).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const tryLine = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(tryLine, size) <= width) line = tryLine;
        else { if (line) out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  };
  const paragraph = (s: string, size = 9.5, color = INK, width = PAGE_W - 2 * M) => {
    for (const l of wrap(s, width, size)) { ensure(size + 4); text(l, M, size, regular, color); y -= size + 4; }
  };
  const rule = () => { page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.6, color: RULE }); };

  // ---- Header ----
  const business = settings.business_name || "Kata";
  text(business, M, 22, bold);
  textRight("PRESUPUESTO", PAGE_W - M, 12, bold, ACCENT);
  y -= 16;
  if (settings.business_contact) text(settings.business_contact, M, 9, regular, MUTED);
  textRight(`N° ${quote.number}`, PAGE_W - M, 10, bold);
  y -= 13;
  textRight(`Fecha: ${fmtDate(quote.date)}`, PAGE_W - M, 9, regular, MUTED);
  y -= 12;
  if (quote.valid_until) textRight(`Válido hasta: ${fmtDate(quote.valid_until)}`, PAGE_W - M, 9, regular, MUTED);
  y -= 18;
  rule();
  y -= 22;

  // ---- Client & job ----
  if (quote.client_name || quote.client_contact) {
    text("Cliente", M, 8.5, bold, MUTED); y -= 13;
    if (quote.client_name) { text(String(quote.client_name), M, 11, bold); y -= 14; }
    if (quote.client_contact) { text(String(quote.client_contact), M, 9.5, regular, MUTED); y -= 14; }
    y -= 8;
  }
  text("Trabajo", M, 8.5, bold, MUTED); y -= 15;
  for (const l of wrap(String(quote.title), PAGE_W - 2 * M, 13, bold)) { text(l, M, 13, bold); y -= 16; }
  if (quote.description) { y -= 2; paragraph(String(quote.description), 9.5, MUTED); }
  y -= 4;
  text(`Cantidad: ${breakdown.quantity} ${breakdown.quantity === 1 ? "pieza" : "piezas"}`, M, 10, bold);
  y -= 24;

  // ---- Line tables ----
  const colQty = PAGE_W - M - 250;
  const colUnit = PAGE_W - M - 110;
  const colSub = PAGE_W - M;
  const descWidth = colQty - M - 70;

  const tableHeader = () => {
    text("Descripción", M, 8, bold, MUTED);
    textRight("Cantidad", colQty, 8, bold, MUTED);
    textRight("Precio unit.", colUnit, 8, bold, MUTED);
    textRight("Subtotal", colSub, 8, bold, MUTED);
    y -= 6; rule(); y -= 13;
  };

  for (const section of SECTION_ORDER) {
    const rows = lines.filter((l) => KIND_SECTION[l.kind as string] === section);
    if (rows.length === 0) continue;
    ensure(60);
    text(SECTION_TITLES[section], M, 10.5, bold);
    y -= 15;
    tableHeader();
    for (const l of rows) {
      const descLines = wrap(String(l.description), descWidth, 9.5);
      const scopeNote =
        l.kind === "one_time" ? "una vez" :
        l.scope === "per_piece" && breakdown.quantity > 1 ? `${qtyText(Number(l.quantity))} ${l.unit || ""} por pieza`.trim() :
        l.scope === "per_batch" && breakdown.quantity > 1 ? "por tanda" : "";
      const lossNote = l.apply_metal_loss && Number(quote.metal_loss_pct) > 0 ? `incluye ${qtyText(Number(quote.metal_loss_pct))}% de merma` : "";
      const notes = [scopeNote, lossNote].filter(Boolean).join(" · ");
      ensure(14 * descLines.length + (notes ? 12 : 0) + 6);
      text(descLines[0], M, 9.5);
      textRight(`${qtyText(Number(l.effective_quantity))} ${l.unit || ""}`.trim(), colQty, 9.5);
      textRight(money(Number(l.unit_cost)), colUnit, 9.5, regular, MUTED);
      textRight(money(Number(l.cost)), colSub, 9.5);
      y -= 13;
      for (const extra of descLines.slice(1)) { text(extra, M, 9.5); y -= 13; }
      if (notes) { text(notes, M, 8, regular, MUTED); y -= 12; }
      y -= 2;
    }
    rule(); y -= 13;
    textRight(`Subtotal ${SECTION_TITLES[section].split(" (")[0].toLowerCase()}`, colUnit, 9, regular, MUTED);
    textRight(money(breakdown.sections[section]), colSub, 9.5, bold);
    y -= 26;
  }

  // ---- Totals ----
  ensure(125);
  const labelX = colUnit;
  const totalRow = (label: string, value: string, size = 10, font = regular, color = INK) => {
    textRight(label, labelX, size, font, font === bold ? INK : MUTED);
    textRight(value, colSub, size, font, color);
    y -= size + 7;
  };
  totalRow("Subtotal costos", money(breakdown.subtotal));
  if (breakdown.failure_allowance > 0) totalRow(`Reserva por fallas y repeticiones (${qtyText(Number(quote.failure_pct))}%)`, money(breakdown.failure_allowance));
  if (breakdown.margin > 0) totalRow(`Margen del taller (${qtyText(Number(quote.margin_pct))}%)`, money(breakdown.margin));
  y -= 2;
  page.drawLine({ start: { x: colUnit - 150, y: y + 4 }, end: { x: colSub, y: y + 4 }, thickness: 0.8, color: INK });
  y -= 12;
  totalRow("TOTAL", money(breakdown.total), 13, bold, INK);
  if (breakdown.quantity > 1) totalRow("Precio por pieza", money(breakdown.unit_price), 10, bold, INK);
  if (breakdown.deposit > 0) totalRow(`Seña para comenzar (${qtyText(Number(quote.deposit_pct))}%)`, money(breakdown.deposit), 10, regular, INK);
  y -= 14;

  // ---- Price breaks ----
  if (price_breaks.length > 0) {
    ensure(40 + 14 * price_breaks.length);
    text("Precio según cantidad", M, 10.5, bold); y -= 15;
    const c1 = M + 80, c2 = M + 230, c3 = M + 360;
    textRight("Cantidad", c1, 8, bold, MUTED); textRight("Precio por pieza", c2, 8, bold, MUTED); textRight("Total", c3, 8, bold, MUTED);
    y -= 6; page.drawLine({ start: { x: M, y }, end: { x: c3, y }, thickness: 0.6, color: RULE }); y -= 13;
    const all = [...price_breaks, { quantity: breakdown.quantity, unit_price: breakdown.unit_price, total: breakdown.total }].sort((a, b) => a.quantity - b.quantity);
    for (const pb of all) {
      const isBase = pb.quantity === breakdown.quantity;
      const f = isBase ? bold : regular;
      textRight(String(pb.quantity), c1, 9.5, f); textRight(money(pb.unit_price), c2, 9.5, f); textRight(money(pb.total), c3, 9.5, f);
      y -= 14;
    }
    y -= 12;
  }

  // ---- Notes ----
  const hasMetal = lines.some((l) => l.apply_metal_loss);
  const terms: string[] = [];
  if (quote.notes) terms.push(String(quote.notes));
  if (hasMetal) terms.push(`El metal está cotizado al precio de reposición del ${fmtDate(quote.date)}. Si el presupuesto vence, se actualiza al precio del día.`);
  if (quote.valid_until) terms.push(`Presupuesto válido hasta el ${fmtDate(quote.valid_until)}.`);
  if (terms.length) {
    ensure(40);
    text("Condiciones", M, 10.5, bold); y -= 15;
    for (const t of terms) { paragraph(t, 9, MUTED); y -= 3; }
  }

  // ---- Footer on every page ----
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const f = safe(regular, `${business} · Presupuesto ${quote.number} · ${i + 1}/${pages.length}`);
    p.drawText(f, { x: M, y: M - 18, size: 7.5, font: regular, color: MUTED });
  });

  return doc.save();
}
