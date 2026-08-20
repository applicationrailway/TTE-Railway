import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/AdminLayout";
import {
  fetchAllSheetRows,
  addSheetRow,
  updateSheetRow,
  deleteSheetRow,
  emptySheetRow,
  buildSheetRowFromEntry,
  type SheetRow,
  type CaseValue,
  type FareCaseValue,
} from "@/services/sheetReport";
import { fetchAllEntries, type Entry } from "@/services/entries";
import { fetchAllUsers } from "@/services/users";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Download, Loader2, X, Printer } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";

export const Route = createFileRoute("/admin/sheet")({
  head: () => ({ meta: [{ title: "Sheet · Admin" }] }),
  component: AdminSheetPage,
});

type SimpleCatKey = "C" | "D" | "E" | "smoking" | "litteringCases";
type FareCatKey = "A" | "B";

const SIMPLE_CATS: { key: SimpleCatKey; label: string }[] = [
  { key: "C", label: "C Cases" },
  { key: "D", label: "D Cases" },
  { key: "E", label: "E Case" },
  { key: "smoking", label: "Smoking" },
  { key: "litteringCases", label: "Littering" },
];

function fareTotal(val: FareCaseValue | undefined): number {
  if (!val) return 0;
  return (val.nc || 0) * ((val.fare || 0) + (val.eFare || 0));
}
function abSubtotal(row: SheetRow) {
  const nc = (row.A?.nc || 0) + (row.B?.nc || 0);
  const amt = fareTotal(row.A) + fareTotal(row.B);
  return { nc, amt };
}
function abcSubtotal(row: SheetRow) {
  const nc = (row.A?.nc || 0) + (row.B?.nc || 0) + (row.C?.nc || 0);
  const amt = fareTotal(row.A) + fareTotal(row.B) + (row.C?.amt || 0);
  return { nc, amt };
}

function grandTotals(row: SheetRow) {
  const abc = abcSubtotal(row);
  const nc = abc.nc + (row.D?.nc || 0) + (row.E?.nc || 0) + (row.smoking?.nc || 0) + (row.litteringCases?.nc || 0);
  const amt = abc.amt + (row.D?.amt || 0) + (row.E?.amt || 0) + (row.smoking?.amt || 0) + (row.litteringCases?.amt || 0);
  const avgNc = row.wd > 0 ? nc / row.wd : 0;
  const avgAmt = row.wd > 0 ? amt / row.wd : 0;
  return { nc, amt, avgNc, avgAmt };
}

// Report-specific total: matches the printed PDF format (AB+C+D+Littering+Smoking),
// deliberately excludes E Case since the PDF layout doesn't show it, and has no average.
function reportGrandTotal(row: SheetRow) {
  const ab = abSubtotal(row);
  const nc = ab.nc + (row.C?.nc || 0) + (row.D?.nc || 0) + (row.smoking?.nc || 0) + (row.litteringCases?.nc || 0);
  const amt = ab.amt + (row.C?.amt || 0) + (row.D?.amt || 0) + (row.smoking?.amt || 0) + (row.litteringCases?.amt || 0);
  return { nc, amt };
}

// ── Colored PDF-style export/print — matches "Ten Days Ticket Checking
// Performance" layout with section-colored headers. The community `xlsx`
// package can't write cell colors into real .xlsx, so we build a styled
// HTML table and (a) save it with an .xls extension — Excel opens HTML
// content and keeps the colors — and (b) reuse the same HTML to print.
// Light/pastel palette — used for the Combined Statement (10-day + monthly)
const SLOT_COLORS_LIGHT = {
  slot1: "#dbeafe",   // 1-10 — light blue
  slot2: "#dcfce7",   // 11-20 — light green
  slot3: "#fef3c7",   // 21-31 — light amber
  monthly: "#ede9fe", // Monthly — light purple
  total: "#e5e7eb",   // Grand Total — light gray
};

// Monochromatic blue theme — matches dashboard primary color, darkest for
// Grand Total, progressively lighter/fading blue moving left to right.
const SECTION_COLORS = {
  a: "#172554",         // A Cases — darkest navy blue
  b: "#1e3a8a",         // B Cases — dark blue
  ab: "#1d4ed8",        // A+B subtotal — blue
  c: "#2563eb",         // C Cases — medium blue
  abc: "#3b82f6",       // A+B+C subtotal — medium-light blue
  d: "#60a5fa",         // D Cases — light blue
  littering: "#1e40af", // Littering — dark blue (repeats for visual anchor)
  smoking: "#2563eb",   // Smoking — medium blue
  total: "#0c1a3d",     // Grand Total — deepest navy, stands out most
};

function buildSheetHtml(
  rows: SheetRow[],
  titleOverride?: { title: string; subtitle: string; div?: string },
): string {
  const th = (text: string, color: string, colspan = 1, rowspan = 1) =>
    `<th colspan="${colspan}" rowspan="${rowspan}" style="background:${color};color:#fff;border:1px solid #999;padding:5px 6px;">${text}</th>`;
  const thPlain = (text: string, rowspan = 1) =>
    `<th rowspan="${rowspan}" style="background:#e5e7eb;color:#111;border:1px solid #999;padding:5px 6px;">${text}</th>`;
  const subTh = (text: string, color: string) =>
    `<th style="background:${color}22;color:#111;border:1px solid #999;padding:4px 6px;font-weight:600;">${text}</th>`;

  const headerRow1 = `
    <tr>
      ${thPlain("Sl No", 2)}
      ${thPlain("", 2)}
      ${thPlain("Name of Staff", 2)}
      ${thPlain("", 2)}
      ${thPlain("W/D", 2)}
      ${th("A Cases", SECTION_COLORS.a, 4)}
      ${th("B Cases", SECTION_COLORS.b, 4)}
      ${th("A+B", SECTION_COLORS.ab, 2)}
      ${th("C Cases", SECTION_COLORS.c, 2)}
      ${th("A+B+C", SECTION_COLORS.abc, 2)}
      ${th("D Cases", SECTION_COLORS.d, 2)}
      ${th("Littering", SECTION_COLORS.littering, 2)}
      ${th("Smoking", SECTION_COLORS.smoking, 2)}
      ${th("Grand Total", SECTION_COLORS.total, 2)}
    </tr>`;

  const headerRow2 = `
    <tr>
      ${subTh("NC", SECTION_COLORS.a)}${subTh("F", SECTION_COLORS.a)}${subTh("EF", SECTION_COLORS.a)}${subTh("T", SECTION_COLORS.a)}
      ${subTh("NC", SECTION_COLORS.b)}${subTh("F", SECTION_COLORS.b)}${subTh("EF", SECTION_COLORS.b)}${subTh("T", SECTION_COLORS.b)}
      ${subTh("NC", SECTION_COLORS.ab)}${subTh("AMT", SECTION_COLORS.ab)}
      ${subTh("NC", SECTION_COLORS.c)}${subTh("AMT", SECTION_COLORS.c)}
      ${subTh("NC", SECTION_COLORS.abc)}${subTh("AMT", SECTION_COLORS.abc)}
      ${subTh("NC", SECTION_COLORS.d)}${subTh("AMT", SECTION_COLORS.d)}
      ${subTh("NC", SECTION_COLORS.littering)}${subTh("AMT", SECTION_COLORS.littering)}
      ${subTh("NC", SECTION_COLORS.smoking)}${subTh("AMT", SECTION_COLORS.smoking)}
      ${subTh("NC", SECTION_COLORS.total)}${subTh("AMT", SECTION_COLORS.total)}
    </tr>`;

  const td = (val: string | number, bold = false) =>
    `<td style="border:1px solid #ccc;padding:4px 6px;text-align:center;${bold ? "font-weight:700;" : ""}">${val}</td>`;

  const bodyRows = rows
    .map((r, i) => {
      const ab = abSubtotal(r);
      const abc = abcSubtotal(r);
      const t = reportGrandTotal(r);
      return `
        <tr>
          ${td(i + 1)}
          ${td("NGP")}
          <td style="border:1px solid #ccc;padding:4px 6px;text-align:left;">${r.name}</td>
          ${td(r.base)}
          ${td(r.wd)}
          ${td(r.A.nc)}${td(r.A.fare)}${td(r.A.eFare)}${td(fareTotal(r.A).toFixed(0), true)}
          ${td(r.B.nc)}${td(r.B.fare)}${td(r.B.eFare)}${td(fareTotal(r.B).toFixed(0), true)}
          ${td(ab.nc, true)}${td(ab.amt.toFixed(0), true)}
          ${td(r.C.nc)}${td(r.C.amt)}
          ${td(abc.nc, true)}${td(abc.amt.toFixed(0), true)}
          ${td(r.D.nc)}${td(r.D.amt)}
          ${td(r.litteringCases.nc)}${td(r.litteringCases.amt)}
          ${td(r.smoking.nc)}${td(r.smoking.amt)}
          ${td(t.nc, true)}${td(t.amt.toFixed(0), true)}
        </tr>`;
    })
    .join("");

  const grand = rows.reduce(
    (acc, r) => {
      const t = reportGrandTotal(r);
      return { nc: acc.nc + t.nc, amt: acc.amt + t.amt };
    },
    { nc: 0, amt: 0 },
  );

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>TTE Earning Sheet</title>
        <style>
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header-row { display: flex; align-items: center; justify-content: space-between; }
          .header-spacer { width: 140px; }
          .header-div { width: 140px; text-align: right; font-size: 13px; font-weight: bold; }
          h1 { flex: 1; font-size: 16px; margin: 0; text-align: center; }
          h2 { font-size: 13px; margin: 2px 0 14px; text-align: center; color: #444; font-weight: normal; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          @media print {
            @page { size: landscape; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="header-row">
          <div class="header-spacer"></div>
          <h1>${titleOverride ? titleOverride.title : "SOUTH EAST CENTRAL RAILWAY — NAGPUR DIVISION"}</h1>
          <div class="header-div">${titleOverride?.div ?? ""}</div>
        </div>
        <h2>${titleOverride ? titleOverride.subtitle : `TICKET CHECKING PERFORMANCE SHEET · Generated ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}</h2>
        <table>
          <thead>${headerRow1}${headerRow2}</thead>
          <tbody>${bodyRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="25" style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:700;background:#f3f4f6;">GRAND TOTAL</td>
              <td style="border:1px solid #ccc;padding:6px;text-align:center;font-weight:700;background:#f3f4f6;">${grand.nc}</td>
              <td style="border:1px solid #ccc;padding:6px;text-align:center;font-weight:700;background:#f3f4f6;">${grand.amt.toFixed(0)}</td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>`;
}

// Hex color (e.g. "#1e40af") -> ARGB string ExcelJS needs (e.g. "FF1E40AF")
function toArgb(hex: string): string {
  return "FF" + hex.replace("#", "").toUpperCase();
}

async function exportSheetToExcel(
  rows: SheetRow[],
  titleOverride?: { title: string; subtitle: string; filename: string; div?: string },
) {
  if (rows.length === 0) {
    toast.error("No rows to export");
    return;
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("TTE Earning Sheet");
  const thinBorder = {
    top: { style: "thin" as const },
    left: { style: "thin" as const },
    bottom: { style: "thin" as const },
    right: { style: "thin" as const },
  };

  const colCount = 27;
  for (let c = 1; c <= colCount; c++) {
    ws.getColumn(c).width = c === 3 ? 22 : 10;
  }

  const divText = titleOverride?.div ?? "";
  const divColSpan = divText ? Math.max(3, Math.round(colCount * 0.12)) : 0;

  if (divText) {
    ws.mergeCells(1, 1, 1, colCount - divColSpan);
    const railwayCell = ws.getCell(1, 1);
    railwayCell.value = titleOverride!.title;
    railwayCell.font = { bold: true, size: 14 };
    railwayCell.alignment = { horizontal: "center" };

    ws.mergeCells(1, colCount - divColSpan + 1, 1, colCount);
    const divCell = ws.getCell(1, colCount - divColSpan + 1);
    divCell.value = divText;
    divCell.font = { bold: true, size: 11 };
    divCell.alignment = { horizontal: "right" };
  } else {
    ws.mergeCells(1, 1, 1, colCount);
    ws.getCell(1, 1).value = titleOverride ? titleOverride.title : "SOUTH EAST CENTRAL RAILWAY — NAGPUR DIVISION";
    ws.getCell(1, 1).font = { bold: true, size: 14 };
    ws.getCell(1, 1).alignment = { horizontal: "center" };
  }

  ws.mergeCells(2, 1, 2, colCount);
  ws.getCell(2, 1).value = titleOverride
    ? titleOverride.subtitle
    : `TICKET CHECKING PERFORMANCE SHEET · Generated ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: "FF555555" } };
  ws.getCell(2, 1).alignment = { horizontal: "center" };

  const headerRowIdx = 4;
  const subHeaderRowIdx = 5;

  interface Group { label: string; color: string; subLabels: string[]; }
  const groups: Group[] = [
    { label: "A Cases", color: SECTION_COLORS.a, subLabels: ["NC", "F", "EF", "T"] },
    { label: "B Cases", color: SECTION_COLORS.b, subLabels: ["NC", "F", "EF", "T"] },
    { label: "A+B", color: SECTION_COLORS.ab, subLabels: ["NC", "AMT"] },
    { label: "C Cases", color: SECTION_COLORS.c, subLabels: ["NC", "AMT"] },
    { label: "A+B+C", color: SECTION_COLORS.abc, subLabels: ["NC", "AMT"] },
    { label: "D Cases", color: SECTION_COLORS.d, subLabels: ["NC", "AMT"] },
    { label: "Littering", color: SECTION_COLORS.littering, subLabels: ["NC", "AMT"] },
    { label: "Smoking", color: SECTION_COLORS.smoking, subLabels: ["NC", "AMT"] },
    { label: "G/Total", color: SECTION_COLORS.total, subLabels: ["NC", "AMT"] },
  ];

  const fixedCols = ["Sl No", "NGP", "Name of Staff", "", "W/D"];
  fixedCols.forEach((label, idx) => {
    const col = idx + 1;
    ws.mergeCells(headerRowIdx, col, subHeaderRowIdx, col);
    const cell = ws.getCell(headerRowIdx, col);
    cell.value = label;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
    ws.getCell(subHeaderRowIdx, col).border = thinBorder;
  });

  let col = fixedCols.length + 1;
  for (const g of groups) {
    const startCol = col;
    const endCol = col + g.subLabels.length - 1;
    ws.mergeCells(headerRowIdx, startCol, headerRowIdx, endCol);
    const groupCell = ws.getCell(headerRowIdx, startCol);
    groupCell.value = g.label;
    groupCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(g.color) } };
    groupCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    groupCell.alignment = { horizontal: "center", vertical: "middle" };
    for (let c = startCol; c <= endCol; c++) ws.getCell(headerRowIdx, c).border = thinBorder;

    g.subLabels.forEach((sub, i) => {
      const cell = ws.getCell(subHeaderRowIdx, startCol + i);
      cell.value = sub;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(g.color) } };
      cell.font = { bold: true, size: 10 };
      cell.alignment = { horizontal: "center" };
      cell.border = thinBorder;
    });

    col = endCol + 1;
  }

  let r = subHeaderRowIdx + 1;
  rows.forEach((row, i) => {
    const ab = abSubtotal(row);
    const abc = abcSubtotal(row);
    const t = reportGrandTotal(row);

    const values = [
      i + 1, "NGP", row.name, row.base, row.wd,
      row.A.nc, row.A.fare, row.A.eFare, Number(fareTotal(row.A).toFixed(0)),
      row.B.nc, row.B.fare, row.B.eFare, Number(fareTotal(row.B).toFixed(0)),
      ab.nc, Number(ab.amt.toFixed(0)),
      row.C.nc, row.C.amt,
      abc.nc, Number(abc.amt.toFixed(0)),
      row.D.nc, row.D.amt,
      row.litteringCases.nc, row.litteringCases.amt,
      row.smoking.nc, row.smoking.amt,
      t.nc, Number(t.amt.toFixed(0)),
    ];

    values.forEach((val, ci) => {
      const cell = ws.getCell(r, ci + 1);
      cell.value = val;
      cell.border = thinBorder;
      cell.alignment = { horizontal: ci === 2 ? "left" : "center" };
    });
    r++;
  });

  const grand = rows.reduce(
    (acc, row) => {
      const t = reportGrandTotal(row);
      return { nc: acc.nc + t.nc, amt: acc.amt + t.amt };
    },
    { nc: 0, amt: 0 },
  );
  ws.mergeCells(r, 1, r, colCount - 2);
  const gtLabelCell = ws.getCell(r, 1);
  gtLabelCell.value = "GRAND TOTAL";
  gtLabelCell.font = { bold: true };
  gtLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
  gtLabelCell.alignment = { horizontal: "right" };
  gtLabelCell.border = thinBorder;
  ws.getCell(r, colCount - 1).value = grand.nc;
  ws.getCell(r, colCount).value = Number(grand.amt.toFixed(0));
  [colCount - 1, colCount].forEach((c) => {
    const cell = ws.getCell(r, c);
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    cell.alignment = { horizontal: "center" };
    cell.border = thinBorder;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = titleOverride ? titleOverride.filename : `TTE_Earning_Sheet_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} rows`);
}
function printSheetStatement(
  rows: SheetRow[],
  titleOverride?: { title: string; subtitle: string; div?: string },
) {
  if (rows.length === 0) {
    toast.error("No rows to print");
    return;
  }
  const html = buildSheetHtml(rows, titleOverride);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Pop-up blocked — please allow pop-ups to print");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
// ── Staff-wise + Month-wise summary aggregation ──────────────────────────
interface CatTotal { nc: number; amt: number; }
interface FareCatTotal extends CatTotal { fare: number; eFare: number; }
interface StaffAgg {
  base: string;
  name: string;
  month?: string; // "YYYY-MM", only set for monthly aggregates
  wd: number;
  A: FareCatTotal; B: FareCatTotal; C: CatTotal; D: CatTotal; E: CatTotal;
  smoking: CatTotal; litteringCases: CatTotal;
}

function aggregateSheetRows(rows: SheetRow[], includeMonth: boolean): StaffAgg[] {
  const map = new Map<string, StaffAgg>();
  for (const row of rows) {
    const staffKey = row.collectorId || row.name || "unknown";
    const month = row.sourceMonth || "—";
    const key = includeMonth ? `${staffKey}|${month}` : staffKey;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        base: row.base, name: row.name, month: includeMonth ? month : undefined, wd: 0,
        A: { nc: 0, amt: 0, fare: 0, eFare: 0 }, B: { nc: 0, amt: 0, fare: 0, eFare: 0 }, C: { nc: 0, amt: 0 },
        D: { nc: 0, amt: 0 }, E: { nc: 0, amt: 0 }, smoking: { nc: 0, amt: 0 },
        litteringCases: { nc: 0, amt: 0 },
      };
      map.set(key, agg);
    }
    agg.wd += row.wd || 0;
    agg.A.nc += row.A.nc || 0; agg.A.amt += fareTotal(row.A);
    agg.A.fare += (row.A.nc || 0) * (row.A.fare || 0);
    agg.A.eFare += (row.A.nc || 0) * (row.A.eFare || 0);
    agg.B.nc += row.B.nc || 0; agg.B.amt += fareTotal(row.B);
    agg.B.fare += (row.B.nc || 0) * (row.B.fare || 0);
    agg.B.eFare += (row.B.nc || 0) * (row.B.eFare || 0);
    agg.C.nc += row.C.nc || 0; agg.C.amt += row.C.amt || 0;
    agg.D.nc += row.D.nc || 0; agg.D.amt += row.D.amt || 0;
    agg.E.nc += row.E.nc || 0; agg.E.amt += row.E.amt || 0;
    agg.smoking.nc += row.smoking.nc || 0; agg.smoking.amt += row.smoking.amt || 0;
    agg.litteringCases.nc += row.litteringCases.nc || 0; agg.litteringCases.amt += row.litteringCases.amt || 0;
  }
  return Array.from(map.values()).sort(
    (a, b) => a.name.localeCompare(b.name) || (a.month || "").localeCompare(b.month || ""),
  );
}

function monthLabel(ym: string): string {
  if (!ym || ym === "—") return "—";
  const [y, m] = ym.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function aggToSheetData(aggs: StaffAgg[], includeMonth: boolean): (string | number)[][] {
  const header: (string | number)[] = ["Sl No", "Base", "Name of Staff"];
  if (includeMonth) header.push("Month");
 header.push(
    "WD",
    "A NC", "A Fare", "A E-Fare", "A AMT",
    "B NC", "B Fare", "B E-Fare", "B AMT",
    "C NC", "C AMT",
    "D NC", "D AMT",
    "E NC", "E AMT",
    "Smoking NC", "Smoking AMT",
    "Littering NC", "Littering AMT",
    "Total NC", "Total AMT",
    "Avg NC", "Avg AMT",
  );

  const dataRows = aggs.map((a, i) => {
    const nc = a.A.nc + a.B.nc + a.C.nc + a.D.nc + a.E.nc + a.smoking.nc + a.litteringCases.nc;
    const amt = a.A.amt + a.B.amt + a.C.amt + a.D.amt + a.E.amt + a.smoking.amt + a.litteringCases.amt;
    const avgNc = a.wd > 0 ? nc / a.wd : 0;
    const avgAmt = a.wd > 0 ? amt / a.wd : 0;
    const row: (string | number)[] = [i + 1, a.base, a.name];
    if (includeMonth) row.push(monthLabel(a.month || "—"));
    row.push(
      a.wd,
      a.A.nc, Number(a.A.fare.toFixed(0)), Number(a.A.eFare.toFixed(0)), Number(a.A.amt.toFixed(0)),
      a.B.nc, Number(a.B.fare.toFixed(0)), Number(a.B.eFare.toFixed(0)), Number(a.B.amt.toFixed(0)),
      a.C.nc, Number(a.C.amt.toFixed(0)),
      a.D.nc, Number(a.D.amt.toFixed(0)),
      a.E.nc, Number(a.E.amt.toFixed(0)),
      a.smoking.nc, Number(a.smoking.amt.toFixed(0)),
      a.litteringCases.nc, Number(a.litteringCases.amt.toFixed(0)),
      nc, Number(amt.toFixed(0)),
      Number(avgNc.toFixed(1)), Number(avgAmt.toFixed(1)),
    );
    return row;
  });
  return [header, ...dataRows];
}

function exportStaffSummaryToExcel(rows: SheetRow[]) {
  if (rows.length === 0) {
    toast.error("No rows to export");
    return;
  }

  const staffAggs = aggregateSheetRows(rows, false);
  const monthlyAggs = aggregateSheetRows(rows, true);

  const wb = XLSX.utils.book_new();

  const wsStaff = XLSX.utils.aoa_to_sheet(aggToSheetData(staffAggs, false));
  XLSX.utils.book_append_sheet(wb, wsStaff, "Staff Summary");

  const wsMonthly = XLSX.utils.aoa_to_sheet(aggToSheetData(monthlyAggs, true));
  XLSX.utils.book_append_sheet(wb, wsMonthly, "Monthly Summary");

  const filename = `TTE_Staff_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  toast.success(`Exported summary for ${staffAggs.length} staff`);
}

// ── Combined 10-day slot + Monthly statement — one row per staff ──────────
interface SlotTotal {
  nc: number;
  amt: number;
  aFare: number;
  aEFare: number;
  bFare: number;
  bEFare: number;
}
interface CombinedStaffRow {
  base: string;
  name: string;
  slot1: SlotTotal;
  slot2: SlotTotal;
  slot3: SlotTotal;
  monthly: SlotTotal;
}

function emptySlotTotal(): SlotTotal {
  return { nc: 0, amt: 0, aFare: 0, aEFare: 0, bFare: 0, bEFare: 0 };
}

function addToSlot(target: SlotTotal, delta: SlotTotal) {
  target.nc += delta.nc;
  target.amt += delta.amt;
  target.aFare += delta.aFare;
  target.aEFare += delta.aEFare;
  target.bFare += delta.bFare;
  target.bEFare += delta.bEFare;
}

function buildCombinedRows(entries: Entry[], allUsers: { id: string; name: string; base: string }[], month: string) {
  const monthEntries = entries.filter(
    (e) => e.status === "submitted" && e.date.slice(0, 7) === month,
  );

  const map = new Map<string, CombinedStaffRow>();

  for (const e of monthEntries) {
    const user = allUsers.find((u) => u.id === e.collectorId);
    const key = e.collectorId || e.collectorName || "unknown";
    let row = map.get(key);
    if (!row) {
      row = {
        base: user?.base ?? e.collectorBase ?? "",
        name: user?.name ?? e.collectorName ?? "",
        slot1: emptySlotTotal(),
        slot2: emptySlotTotal(),
        slot3: emptySlotTotal(),
        monthly: emptySlotTotal(),
      };
      map.set(key, row);
    }

    const day = Number(e.date.slice(8, 10));
    const delta: SlotTotal = {
      nc: e.totalCases,
      amt: e.totalAmount,
      aFare: e.A?.caseAmt ?? 0,
      aEFare: (e.A?.penaltyAmt ?? 0) + (e.A?.gstAmt ?? 0),
      bFare: e.B?.caseAmt ?? 0,
      bEFare: (e.B?.penaltyAmt ?? 0) + (e.B?.gstAmt ?? 0),
    };

    const bucket = day <= 10 ? row.slot1 : day <= 20 ? row.slot2 : row.slot3;
    addToSlot(bucket, delta);
    addToSlot(row.monthly, delta);
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function combinedGrandTotal(rows: CombinedStaffRow[]) {
  const empty = () => emptySlotTotal();
  return rows.reduce(
    (acc, r) => {
      addToSlot(acc.slot1, r.slot1);
      addToSlot(acc.slot2, r.slot2);
      addToSlot(acc.slot3, r.slot3);
      addToSlot(acc.monthly, r.monthly);
      return acc;
    },
    { slot1: empty(), slot2: empty(), slot3: empty(), monthly: empty() },
  );
}

function slotColumns(s: SlotTotal): (string | number)[] {
  return [
    s.nc,
    Number(s.amt.toFixed(0)),
    Number(s.aFare.toFixed(0)),
    Number(s.aEFare.toFixed(0)),
    Number(s.bFare.toFixed(0)),
    Number(s.bEFare.toFixed(0)),
  ];
}

async function exportCombinedSlotStatement(
  entries: Entry[],
  allUsers: { id: string; name: string; base: string }[],
  month: string,
) {
  const rows = buildCombinedRows(entries, allUsers, month);

  if (rows.length === 0) {
    toast.error("No submitted entries found for this month");
    return;
  }

  const monthLabelStr = new Date(`${month}-01`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Combined Statement");

  const thinBorder = {
    top: { style: "thin" as const },
    left: { style: "thin" as const },
    bottom: { style: "thin" as const },
    right: { style: "thin" as const },
  };

  const colCount = 3 + 6 * 4; // Sl No, Base, Name + 4 slots × 6 sub-columns
  for (let c = 1; c <= colCount; c++) {
    ws.getColumn(c).width = c === 3 ? 22 : 10;
  }

  ws.mergeCells(1, 1, 1, colCount);
  ws.getCell(1, 1).value = "COMBINED 10-DAY + MONTHLY STATEMENT";
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.getCell(1, 1).alignment = { horizontal: "center" };

  ws.mergeCells(2, 1, 2, colCount);
  ws.getCell(2, 1).value = monthLabelStr;
  ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: "FF555555" } };
  ws.getCell(2, 1).alignment = { horizontal: "center" };

  const headerRowIdx = 4;
  const subHeaderRowIdx = 5;

  const fixedCols = ["Sl No", "Base", "Name of Staff"];
  fixedCols.forEach((label, idx) => {
    const col = idx + 1;
    ws.mergeCells(headerRowIdx, col, subHeaderRowIdx, col);
    const cell = ws.getCell(headerRowIdx, col);
    cell.value = label;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
    ws.getCell(subHeaderRowIdx, col).border = thinBorder;
  });

  const slotGroups: { label: string; color: string }[] = [
    { label: "1 – 10", color: SLOT_COLORS_LIGHT.slot1 },
    { label: "11 – 20", color: SLOT_COLORS_LIGHT.slot2 },
    { label: "21 – 31", color: SLOT_COLORS_LIGHT.slot3 },
    { label: "Monthly", color: SLOT_COLORS_LIGHT.monthly },
  ];
  const subLabels = ["NC", "AMT", "A Fare", "A E-Fare", "B Fare", "B E-Fare"];

  let col = fixedCols.length + 1;
  for (const g of slotGroups) {
    const startCol = col;
    const endCol = col + subLabels.length - 1;
    ws.mergeCells(headerRowIdx, startCol, headerRowIdx, endCol);
    const groupCell = ws.getCell(headerRowIdx, startCol);
    groupCell.value = g.label;
    groupCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(g.color) } };
    groupCell.font = { bold: true, color: { argb: "FF1F2937" } };
    groupCell.alignment = { horizontal: "center", vertical: "middle" };
    for (let c = startCol; c <= endCol; c++) ws.getCell(headerRowIdx, c).border = thinBorder;

    subLabels.forEach((sub, i) => {
      const cell = ws.getCell(subHeaderRowIdx, startCol + i);
      cell.value = sub;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(g.color) } };
      cell.font = { bold: true, size: 10, color: { argb: "FF1F2937" } };
      cell.alignment = { horizontal: "center" };
      cell.border = thinBorder;
    });

    col = endCol + 1;
  }

  let r = subHeaderRowIdx + 1;
  rows.forEach((row, i) => {
    const values = [
      i + 1, row.base, row.name,
      ...slotColumns(row.slot1),
      ...slotColumns(row.slot2),
      ...slotColumns(row.slot3),
      ...slotColumns(row.monthly),
    ];
    values.forEach((val, ci) => {
      const cell = ws.getCell(r, ci + 1);
      cell.value = val;
      cell.border = thinBorder;
      cell.alignment = { horizontal: ci === 2 ? "left" : "center" };
    });
    r++;
  });

  const grandTotal = combinedGrandTotal(rows);
  const totalValues = [
    "", "", "GRAND TOTAL",
    ...slotColumns(grandTotal.slot1),
    ...slotColumns(grandTotal.slot2),
    ...slotColumns(grandTotal.slot3),
    ...slotColumns(grandTotal.monthly),
  ];
  totalValues.forEach((val, ci) => {
    const cell = ws.getCell(r, ci + 1);
    cell.value = val;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(SLOT_COLORS_LIGHT.total) } };
    cell.alignment = { horizontal: ci === 2 ? "right" : "center" };
    cell.border = thinBorder;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Combined_Statement_${monthLabelStr.replace(/\s+/g, "_")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success(`Exported combined statement for ${rows.length} staff`);
}

function printCombinedStatement(
  entries: Entry[],
  allUsers: { id: string; name: string; base: string }[],
  month: string,
) {
  const rows = buildCombinedRows(entries, allUsers, month);

  if (rows.length === 0) {
    toast.error("No submitted entries found for this month");
    return;
  }

  const grandTotal = combinedGrandTotal(rows);
  const monthLabelStr = new Date(`${month}-01`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const slotCells = (s: SlotTotal) =>
    `<td>${s.nc}</td><td>${s.amt.toFixed(0)}</td><td>${s.aFare.toFixed(0)}</td><td>${s.aEFare.toFixed(0)}</td><td>${s.bFare.toFixed(0)}</td><td>${s.bEFare.toFixed(0)}</td>`;

  const bodyRows = rows
    .map(
      (r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${r.base}</td>
          <td style="text-align:left">${r.name}</td>
          ${slotCells(r.slot1)}
          ${slotCells(r.slot2)}
          ${slotCells(r.slot3)}
          ${slotCells(r.monthly)}
        </tr>`,
    )
    .join("");

  const slotHeaderCells = `
    <th>NC</th><th>AMT</th><th>A Fare</th><th>A E-Fare</th><th>B Fare</th><th>B E-Fare</th>
  `;

    const html = `
    <html>
      <head>
        <title>Combined Statement — ${monthLabelStr}</title>
        <style>
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body { font-family: Arial, sans-serif; padding: 24px; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          p { font-size: 12px; color: #555; margin-top: 0; margin-bottom: 16px; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          th, td { border: 1px solid #999; padding: 5px 6px; text-align: center; }
          .slot1 { background: ${SLOT_COLORS_LIGHT.slot1}; }
          .slot2 { background: ${SLOT_COLORS_LIGHT.slot2}; }
          .slot3 { background: ${SLOT_COLORS_LIGHT.slot3}; }
          .slotm { background: ${SLOT_COLORS_LIGHT.monthly}; }
          tfoot td { font-weight: bold; background: ${SLOT_COLORS_LIGHT.total}; }
          @media print {
            @page { size: landscape; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <h1>Combined 10-Day + Monthly Statement</h1>
        <p>${monthLabelStr}</p>
        <table>
          <thead>
            <tr>
              <th rowspan="2">Sl No</th>
              <th rowspan="2">Base</th>
              <th rowspan="2">Name of Staff</th>
              <th colspan="6" class="slot1">1 – 10</th>
              <th colspan="6" class="slot2">11 – 20</th>
              <th colspan="6" class="slot3">21 – 31</th>
              <th colspan="6" class="slotm">Monthly</th>
            </tr>
            <tr>
              ${["slot1", "slot2", "slot3", "slotm"].map((cls) => `<th class="${cls}">NC</th><th class="${cls}">AMT</th><th class="${cls}">A Fare</th><th class="${cls}">A E-Fare</th><th class="${cls}">B Fare</th><th class="${cls}">B E-Fare</th>`).join("")}
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="3">GRAND TOTAL</td>
              ${slotCells(grandTotal.slot1)}
              ${slotCells(grandTotal.slot2)}
              ${slotCells(grandTotal.slot3)}
              ${slotCells(grandTotal.monthly)}
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Pop-up blocked — please allow pop-ups to print");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

// ── Build full-category (A/B/C/D/E/Smoking/Littering) staff rows for a
// given period (1-10 / 1-20 / 1-31) directly from submitted entries ──────
function buildPeriodStaffRows(
  entries: Entry[],
  allUsers: { id: string; name: string; base: string }[],
  month: string,
  minDay: number,
  maxDay: number,
): SheetRow[] {
  const filtered = entries.filter((e) => {
    if (e.status !== "submitted" || e.date.slice(0, 7) !== month) return false;
    const day = Number(e.date.slice(8, 10));
    return day >= minDay && day <= maxDay;
  });

  interface Accum {
    base: string;
    name: string;
    dates: Set<string>;
    aNc: number; aFareSum: number; aEFareSum: number;
    bNc: number; bFareSum: number; bEFareSum: number;
    C: CaseValue; D: CaseValue; E: CaseValue; smoking: CaseValue; litteringCases: CaseValue;
  }

  const map = new Map<string, Accum>();

  for (const e of filtered) {
    const user = allUsers.find((u) => u.id === e.collectorId);
    const key = e.collectorId || e.collectorName || "unknown";
    let acc = map.get(key);
    if (!acc) {
      acc = {
        base: user?.base ?? e.collectorBase ?? "",
        name: user?.name ?? e.collectorName ?? "",
        dates: new Set(),
        aNc: 0, aFareSum: 0, aEFareSum: 0,
        bNc: 0, bFareSum: 0, bEFareSum: 0,
        C: { nc: 0, amt: 0 }, D: { nc: 0, amt: 0 }, E: { nc: 0, amt: 0 },
        smoking: { nc: 0, amt: 0 }, litteringCases: { nc: 0, amt: 0 },
      };
      map.set(key, acc);
    }
    acc.dates.add(e.date);
    acc.aNc += e.A?.cases ?? 0;
    acc.aFareSum += e.A?.caseAmt ?? 0;
    acc.aEFareSum += (e.A?.penaltyAmt ?? 0) + (e.A?.gstAmt ?? 0);
    acc.bNc += e.B?.cases ?? 0;
    acc.bFareSum += e.B?.caseAmt ?? 0;
    acc.bEFareSum += (e.B?.penaltyAmt ?? 0) + (e.B?.gstAmt ?? 0);
    acc.C.nc += e.C?.cases ?? 0; acc.C.amt += e.C?.amount ?? 0;
    acc.D.nc += e.D?.cases ?? 0; acc.D.amt += e.D?.amount ?? 0;
    acc.E.nc += e.E?.cases ?? 0; acc.E.amt += e.E?.amount ?? 0;
    acc.smoking.nc += e.smoking?.cases ?? 0; acc.smoking.amt += e.smoking?.amount ?? 0;
    acc.litteringCases.nc += e.litteringCases?.cases ?? 0; acc.litteringCases.amt += e.litteringCases?.amount ?? 0;
  }

  return Array.from(map.entries())
    .map(([key, acc], idx) => ({
      id: `period-${key}-${idx}`,
      order: idx + 1,
      base: acc.base,
      name: acc.name,
      wd: acc.dates.size,
      A: { nc: acc.aNc, fare: acc.aNc > 0 ? acc.aFareSum / acc.aNc : 0, eFare: acc.aNc > 0 ? acc.aEFareSum / acc.aNc : 0 },
      B: { nc: acc.bNc, fare: acc.bNc > 0 ? acc.bFareSum / acc.bNc : 0, eFare: acc.bNc > 0 ? acc.bEFareSum / acc.bNc : 0 },
      C: acc.C, D: acc.D, E: acc.E, smoking: acc.smoking, litteringCases: acc.litteringCases,
      sacking: { nc: 0, amt: 0 },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function periodDateRange(month: string, minDay: number, maxDay: number): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDayOfMonth = new Date(y, m, 0).getDate();
  const clampedMax = Math.min(maxDay, lastDayOfMonth);
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${pad(minDay)}.${pad(m)}.${y}`;
  const to = `${pad(clampedMax)}.${pad(m)}.${y}`;
  return { from, to };
}

function periodReportName(minDay: number, maxDay: number): string {
  const span = maxDay - minDay + 1;
  if (span >= 28) return "MONTHLY";
  if (span >= 20) return "TWENTY DAYS";
  return "TEN DAYS";
}

function periodExport(
  entries: Entry[],
  allUsers: { id: string; name: string; base: string }[],
  month: string,
  minDay: number,
  maxDay: number,
  label: string,
) {
  const rows = buildPeriodStaffRows(entries, allUsers, month, minDay, maxDay);
  if (rows.length === 0) {
    toast.error(`No submitted entries found for this ${label} period`);
    return;
  }
  const { from, to } = periodDateRange(month, minDay, maxDay);
  const reportName = periodReportName(minDay, maxDay);
  const monthLabelStr = new Date(`${month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  void exportSheetToExcel(rows, {
    title: "SOUTH EAST CENTRAL RAILWAY",
    subtitle: `${reportName} TICKET CHECKING PERFORMANCE FOR P.E.:- ${from} to ${to}`,
    div: "DIV:- NAGPUR",
    filename: `${label.replace(/\s+/g, "_")}_Statement_${monthLabelStr.replace(/\s+/g, "_")}.xlsx`,
  });
}

function periodPrint(
  entries: Entry[],
  allUsers: { id: string; name: string; base: string }[],
  month: string,
  minDay: number,
  maxDay: number,
  label: string,
) {
  const rows = buildPeriodStaffRows(entries, allUsers, month, minDay, maxDay);
  if (rows.length === 0) {
    toast.error(`No submitted entries found for this ${label} period`);
    return;
  }
  const { from, to } = periodDateRange(month, minDay, maxDay);
  const reportName = periodReportName(minDay, maxDay);
  printSheetStatement(rows, {
    title: "SOUTH EAST CENTRAL RAILWAY",
    subtitle: `${reportName} TICKET CHECKING PERFORMANCE FOR P.E.:- ${from} to ${to}`,
    div: "DIV:- NAGPUR",
  });
}

const PERIOD_OPTIONS = [
  { value: "1-10", label: "Day 1 – 10", minDay: 1, maxDay: 10 },
  { value: "11-20", label: "Day 11 – 20", minDay: 11, maxDay: 20 },
  { value: "21-31", label: "Day 21 – 31", minDay: 21, maxDay: 31 },
  { value: "1-20", label: "Day 1 – 20 (Cumulative)", minDay: 1, maxDay: 20 },
  
] as const;

function AdminSheetPage() {
  const { data: fetchedRows = [], isLoading } = useQuery({
    queryKey: ["admin", "sheetRows"],
    queryFn: fetchAllSheetRows,
  });
  const { data: allEntries = [] } = useQuery({
    queryKey: ["admin", "entries"],
    queryFn: fetchAllEntries,
    refetchInterval: 5000, // poll every 5s so newly submitted entries auto-sync into Sheet without a manual reload
  });
  const { data: allUsers = [] } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAllUsers,
  });

 const [rows, setRows] = useState<SheetRow[]>([]);
    const [combinedMonth, setCombinedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedPeriod, setSelectedPeriod] = useState<string>("1-10");
  const [showCombinedModal, setShowCombinedModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const initialized = useRef(false);
  const lastSyncSignature = useRef<string>("");
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

useEffect(() => {
    if (initialized.current || isLoading) return;
    setRows(fetchedRows);
    initialized.current = true;
  }, [fetchedRows, isLoading]);

// ── Auto-sync Sheet rows from submitted entries — 1 entry = 1 row ──
  // Every submitted entry gets its own Sheet row, matched by entryId. Editing
  // an entry (same-day, one-time edit) updates its row in place; it never
  // merges multiple entries into one row anymore. `order` and `sacking` stay
  // untouched on existing rows since they have no source in Entry data and
  // are meant to be set manually by the admin.
  useEffect(() => {
    if (!initialized.current) return;
    if (allEntries.length === 0 || allUsers.length === 0) return;

    const signature = allEntries
      .filter((e) => e.status === "submitted")
      .map((e) => `${e.id}:${e.totalCases}:${e.totalAmount}`)
      .sort()
      .join("|");
    if (signature === lastSyncSignature.current) return;
    lastSyncSignature.current = signature;

    async function sync() {
      const latestRows = await fetchAllSheetRows();

      const thisMonth = new Date().toISOString().slice(0, 7);
      const submittedThisMonth = allEntries.filter(
        (e) => e.status === "submitted" && e.date.slice(0, 7) === thisMonth,
      );

      const existingByEntryId = new Map(
        latestRows.filter((r) => r.entryId).map((r) => [r.entryId as string, r] as const),
      );

      let nextOrder = latestRows.length > 0 ? Math.max(...latestRows.map((r) => r.order)) + 1 : 1;
      const toCreate: Omit<SheetRow, "id">[] = [];
      const toUpdate: { id: string; patch: Partial<Omit<SheetRow, "id">> }[] = [];

      for (const entry of submittedThisMonth) {
        if (!entry.id) continue;
        const collectorUser = allUsers.find((u) => u.id === entry.collectorId);
        const existing = existingByEntryId.get(entry.id);

        const built = buildSheetRowFromEntry(
          {
            id: entry.collectorId,
            name: collectorUser?.name ?? entry.collectorName ?? "",
            base: collectorUser?.base ?? entry.collectorBase ?? "",
          },
          entry,
          existing ? existing.order : nextOrder,
        );

        if (existing) {
          const { order, sacking, ...patch } = built;
          toUpdate.push({ id: existing.id as string, patch });
        } else {
          toCreate.push(built);
          nextOrder++;
        }
      }

      try {
        const [created] = await Promise.all([
          Promise.all(toCreate.map(async (row) => ({ ...row, id: await addSheetRow(row) }))),
          Promise.all(toUpdate.map(({ id, patch }) => updateSheetRow(id, patch))),
        ]);

        if (created.length > 0 || toUpdate.length > 0) {
          setRows((rs) => {
            const patchMap = new Map(toUpdate.map((u) => [u.id, u.patch]));
            const updatedExisting = rs.map((r) =>
              r.id && patchMap.has(r.id) ? { ...r, ...patchMap.get(r.id) } : r,
            );
            return [...updatedExisting, ...created];
          });
          if (created.length > 0) {
            toast.success(`Added ${created.length} new row(s) from entries`);
          }
        }
      } catch {
        toast.error("Failed to sync some rows from entries");
      }
    }

    sync();
  }, [allEntries, allUsers]);

  function scheduleSave(id: string, patch: Partial<Omit<SheetRow, "id">>) {
    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      try {
        await updateSheetRow(id, patch);
      } catch {
        toast.error("Failed to save changes");
      }
    }, 500);
  }

  function patchRow(id: string | undefined, patch: Partial<Omit<SheetRow, "id">>) {
    if (!id) return;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    scheduleSave(id, patch);
  }

  function patchSimpleCategory(
    id: string | undefined,
    cat: SimpleCatKey,
    field: keyof CaseValue,
    value: number,
  ) {
    if (!id) return;
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r[cat], [field]: value };
        scheduleSave(id, { [cat]: updated } as Partial<Omit<SheetRow, "id">>);
        return { ...r, [cat]: updated };
      }),
    );
  }

  function patchFareCategory(
    id: string | undefined,
    cat: FareCatKey,
    field: keyof FareCaseValue,
    value: number,
  ) {
    if (!id) return;
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r[cat], [field]: value };
        scheduleSave(id, { [cat]: updated } as Partial<Omit<SheetRow, "id">>);
        return { ...r, [cat]: updated };
      }),
    );
  }

  async function handleAddRow() {
    const order = rows.length > 0 ? Math.max(...rows.map((r) => r.order)) + 1 : 1;
    const newRow = emptySheetRow(order);
    try {
      const id = await addSheetRow(newRow);
      setRows((rs) => [...rs, { ...newRow, id }]);
    } catch {
      toast.error("Failed to add row");
    }
  }

  async function handleDeleteRow(id: string | undefined) {
    if (!id) return;
    try {
      await deleteSheetRow(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
      toast.success("Row deleted");
    } catch {
      toast.error("Failed to delete row");
    }
  }

  const grandTotal = rows.reduce(
    (acc, r) => {
      const t = grandTotals(r);
      return { nc: acc.nc + t.nc, amt: acc.amt + t.amt };
    },
    { nc: 0, amt: 0 },
  );

  const thick = "border-r-4 border-r-foreground/50";

  return (
    <AdminLayout>
      {/* Wrapping the whole page in overflow-x-hidden so the table's own
          horizontal scroll never drags the sticky toolbar/page along with it */}
      <div className="w-full min-w-0 overflow-x-hidden">
        {/* Page title/stats — scrolls normally with the page */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold">Sheet</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} staff · {grandTotal.nc} total cases · ₹{grandTotal.amt.toLocaleString("en-IN")}
          </p>
        </div>

       {/* Buttons — fixed to the viewport, immune to any horizontal/vertical scroll */}
        <div className="fixed right-4 top-20 z-50 hidden flex-wrap items-center gap-2 md:right-8 md:flex">
          <button
            onClick={() => setShowCombinedModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevated"
          >
            <Download className="h-4 w-4" /> Combined Statement
          </button>
          <button
            onClick={handleAddRow}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold shadow-elevated hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Add Row
          </button>
              <button
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold shadow-elevated hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Export Excel
          </button>
          <button
            onClick={() => exportStaffSummaryToExcel(rows)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold shadow-elevated hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Staff Summary
          </button>
        </div>

        {/* Mobile-only buttons — normal inline flow (fixed floating buttons don't work well on small screens) */}
        <div className="mb-4 flex gap-2 md:hidden">
          <button
            onClick={handleAddRow}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Add Row
          </button>
                        <button
            onClick={() => setShowExportModal(true)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card"
          >
            <Download className="h-4 w-4" /> Export Excel
          </button>
        </div>
        <div className="mb-4 md:hidden">
          <button
            onClick={() => exportStaffSummaryToExcel(rows)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Staff Summary
          </button>
        </div>
        <div className="mb-4 md:hidden">
          <button
            onClick={() => setShowCombinedModal(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Download className="h-4 w-4" /> Combined Statement
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[2200px] text-xs">
              <thead className="sticky top-0 z-10 bg-muted/90 text-center font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                <tr>
                  <th rowSpan={2} className={`w-14 border border-border bg-muted px-2 py-2 ${thick}`}>Sl No</th>
                  <th rowSpan={2} className={`w-20 border border-border bg-muted px-2 py-2 ${thick}`}>Base</th>
                  <th rowSpan={2} className={`w-44 border border-border bg-muted px-2 py-2 ${thick}`}>Name of Staff</th>
                  <th rowSpan={2} className={`w-16 border border-border bg-muted px-2 py-2 ${thick}`}>WD</th>

                  <th colSpan={4} className={`border border-border px-2 py-2 ${thick}`}>A Cases</th>
                  <th colSpan={4} className={`border border-border px-2 py-2 ${thick}`}>B Cases</th>
                  <th colSpan={3} className={`border border-border px-2 py-2 ${thick}`}>C Cases</th>
                  <th colSpan={2} className={`border border-border px-2 py-2 ${thick}`}>A+B+C</th>
                  <th colSpan={2} className={`border border-border px-2 py-2 ${thick}`}>Average</th>
                  <th colSpan={2} className={`border border-border px-2 py-2 ${thick}`}>D Cases</th>
                  <th colSpan={2} className={`border border-border px-2 py-2 ${thick}`}>E Case</th>
                  <th colSpan={2} className={`border border-border px-2 py-2 ${thick}`}>Smoking</th>
                  <th colSpan={2} className={`border border-border px-2 py-2 ${thick}`}>Littering</th>
                  <th colSpan={2} className={`border border-border px-2 py-2 ${thick}`}>Total</th>
                  <th colSpan={2} className="border border-border px-2 py-2">Average</th>
                  <th rowSpan={2} className="border border-border px-2 py-2"></th>
                </tr>
                <tr>
                  {/* A Cases */}
                  <th className="border border-border px-2 py-1.5">NC</th>
                  <th className="border border-border px-2 py-1.5">Penalty</th>
                  <th className="border border-border px-2 py-1.5">E/Penalty</th>
                  <th className={`border border-border px-2 py-1.5 ${thick}`}>Total</th>
                  {/* B Cases */}
                  <th className="border border-border px-2 py-1.5">NC</th>
                  <th className="border border-border px-2 py-1.5">E/Penalty</th>
                  <th className="border border-border px-2 py-1.5">Penalty</th>
                  <th className={`border border-border px-2 py-1.5 ${thick}`}>Total</th>
                  {/* C Cases */}
                  <th className="border border-border px-2 py-1.5">NC</th>
                  <th className="border border-border px-2 py-1.5">AMT</th>
                  <th className={`border border-border px-2 py-1.5 ${thick}`}>Total</th>
                  {/* A+B+C */}
                  <th className="border border-border px-2 py-1.5">NC</th>
                  <th className={`border border-border px-2 py-1.5 ${thick}`}>AMT</th>
                  {/* Average of A+B+C */}
                  <th className="border border-border px-2 py-1.5">NC</th>
                  <th className={`border border-border px-2 py-1.5 ${thick}`}>AMT</th>
                  {/* D Cases */}
                  <th className="border border-border px-2 py-1.5">NC</th>
                  <th className={`border border-border px-2 py-1.5 ${thick}`}>AMT</th>
                  {/* E Case */}
                  <th className="border border-border px-2 py-1.5">NC</th>
                  <th className={`border border-border px-2 py-1.5 ${thick}`}>AMT</th>
                  {/* Smoking */}
                  <th className="border border-border px-2 py-1.5">NC</th>
                  <th className={`border border-border px-2 py-1.5 ${thick}`}>AMT</th>
                  {/* Littering */}
                  <th className="border border-border px-2 py-1.5">NC</th>
                  <th className={`border border-border px-2 py-1.5 ${thick}`}>AMT</th>
                  {/* Grand Total */}
                  <th className="border border-border px-2 py-1.5">NC</th>
                  <th className={`border border-border px-2 py-1.5 ${thick}`}>AMT</th>
                  {/* Grand Average */}
                  <th className="border border-border px-2 py-1.5">NC</th>
                  <th className="border border-border px-2 py-1.5">AMT</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const abc = abcSubtotal(row);
                  const abcAvgNc = row.wd > 0 ? abc.nc / row.wd : 0;
                  const abcAvgAmt = row.wd > 0 ? abc.amt / row.wd : 0;
                  const t = grandTotals(row);
                  const aTotal = fareTotal(row.A);
                  const bTotal = fareTotal(row.B);

                  return (
                    <tr key={row.id} className="text-center hover:bg-muted/30">
                      <td className={`w-14 border border-border px-2 py-1.5 font-semibold ${thick}`}>{i + 1}</td>
                      <td className={`w-20 border border-border p-0 ${thick}`}>
                        <input
                          value={row.base}
                          onChange={(e) => patchRow(row.id, { base: e.target.value })}
                          className="w-full bg-transparent px-2 py-1.5 text-center font-semibold outline-none"
                        />
                      </td>
                      <td className={`w-44 border border-border p-0 ${thick}`}>
                        <input
                          value={row.name}
                          onChange={(e) => patchRow(row.id, { name: e.target.value })}
                          className="w-full bg-transparent px-2 py-1.5 text-left outline-none"
                        />
                      </td>
                      <td className={`w-16 border border-border p-0 ${thick}`}>
                        <input
                          type="number"
                          value={row.wd || ""}
                          onChange={(e) => patchRow(row.id, { wd: Number(e.target.value) || 0 })}
                          className="w-full bg-transparent px-2 py-1.5 text-center outline-none"
                        />
                      </td>

                      {/* A Cases */}
                      <td className="border border-border p-0">
                        <input type="number" value={row.A.nc || ""}
                          onChange={(e) => patchFareCategory(row.id, "A", "nc", Number(e.target.value) || 0)}
                          className="w-14 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>
                      <td className="border border-border p-0">
                        <input type="number" value={row.A.fare || ""}
                          onChange={(e) => patchFareCategory(row.id, "A", "fare", Number(e.target.value) || 0)}
                          className="w-14 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>
                      <td className="border border-border p-0">
                        <input type="number" value={row.A.eFare || ""}
                          onChange={(e) => patchFareCategory(row.id, "A", "eFare", Number(e.target.value) || 0)}
                          className="w-14 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>
                      <td className={`border border-border bg-muted/40 px-2 py-1.5 font-semibold ${thick}`}>{aTotal.toFixed(0)}</td>

                      {/* B Cases */}
                      <td className="border border-border p-0">
                        <input type="number" value={row.B.nc || ""}
                          onChange={(e) => patchFareCategory(row.id, "B", "nc", Number(e.target.value) || 0)}
                          className="w-14 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>
                      <td className="border border-border p-0">
                        <input type="number" value={row.B.eFare || ""}
                          onChange={(e) => patchFareCategory(row.id, "B", "eFare", Number(e.target.value) || 0)}
                          className="w-14 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>
                      <td className="border border-border p-0">
                        <input type="number" value={row.B.fare || ""}
                          onChange={(e) => patchFareCategory(row.id, "B", "fare", Number(e.target.value) || 0)}
                          className="w-14 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>
                      <td className={`border border-border bg-muted/40 px-2 py-1.5 font-semibold ${thick}`}>{bTotal.toFixed(0)}</td>

                      {/* C Cases */}
                      <td className="border border-border p-0">
                        <input type="number" value={row.C.nc || ""}
                          onChange={(e) => patchSimpleCategory(row.id, "C", "nc", Number(e.target.value) || 0)}
                          className="w-14 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>
                      <td className="border border-border p-0">
                        <input type="number" value={row.C.amt || ""}
                          onChange={(e) => patchSimpleCategory(row.id, "C", "amt", Number(e.target.value) || 0)}
                          className="w-16 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>
                      <td className={`border border-border bg-muted/40 px-2 py-1.5 font-semibold ${thick}`}>{row.C.amt.toFixed(0)}</td>

                      {/* A+B+C subtotal */}
                      <td className="border border-border bg-muted/30 px-2 py-1.5 font-semibold">{abc.nc}</td>
                      <td className={`border border-border bg-muted/30 px-2 py-1.5 font-semibold ${thick}`}>{abc.amt.toFixed(0)}</td>

                      {/* Average of A+B+C */}
                      <td className="border border-border px-2 py-1.5 text-muted-foreground">{abcAvgNc.toFixed(1)}</td>
                      <td className={`border border-border px-2 py-1.5 text-muted-foreground ${thick}`}>{abcAvgAmt.toFixed(1)}</td>

                      {/* D Cases */}
                      <td className="border border-border p-0">
                        <input type="number" value={row.D.nc || ""}
                          onChange={(e) => patchSimpleCategory(row.id, "D", "nc", Number(e.target.value) || 0)}
                          className="w-14 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>
                      <td className={`border border-border p-0 ${thick}`}>
                        <input type="number" value={row.D.amt || ""}
                          onChange={(e) => patchSimpleCategory(row.id, "D", "amt", Number(e.target.value) || 0)}
                          className="w-16 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>

                      {/* E Case */}
                      <td className="border border-border p-0">
                        <input type="number" value={row.E.nc || ""}
                          onChange={(e) => patchSimpleCategory(row.id, "E", "nc", Number(e.target.value) || 0)}
                          className="w-14 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>
                      <td className={`border border-border p-0 ${thick}`}>
                        <input type="number" value={row.E.amt || ""}
                          onChange={(e) => patchSimpleCategory(row.id, "E", "amt", Number(e.target.value) || 0)}
                          className="w-16 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>

                    {/* Smoking */}
                      <td className="border border-border p-0">
                        <input type="number" value={row.smoking.nc || ""}
                          onChange={(e) => patchSimpleCategory(row.id, "smoking", "nc", Number(e.target.value) || 0)}
                          className="w-14 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>
                      <td className={`border border-border p-0 ${thick}`}>
                        <input type="number" value={row.smoking.amt || ""}
                          onChange={(e) => patchSimpleCategory(row.id, "smoking", "amt", Number(e.target.value) || 0)}
                          className="w-16 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>

                    {/* Littering */}
                      <td className="border border-border p-0">
                        <input type="number" value={row.litteringCases.nc || ""}
                          onChange={(e) => patchSimpleCategory(row.id, "litteringCases", "nc", Number(e.target.value) || 0)}
                          className="w-14 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>
                      <td className={`border border-border p-0 ${thick}`}>
                        <input type="number" value={row.litteringCases.amt || ""}
                          onChange={(e) => patchSimpleCategory(row.id, "litteringCases", "amt", Number(e.target.value) || 0)}
                          className="w-16 bg-transparent px-2 py-1.5 text-center outline-none" />
                      </td>

                      {/* Grand Total + Average */}
                      <td className="border border-border bg-primary-soft px-2 py-1.5 font-bold text-primary">{t.nc}</td>
                      <td className={`border border-border bg-primary-soft px-2 py-1.5 font-bold text-primary ${thick}`}>{t.amt.toFixed(0)}</td>
                      <td className="border border-border px-2 py-1.5 text-muted-foreground">{t.avgNc.toFixed(1)}</td>
                      <td className="border border-border px-2 py-1.5 text-muted-foreground">{t.avgAmt.toFixed(1)}</td>

                      <td className="border border-border px-1 py-1.5">
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={31} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      No rows yet. Click "Add Row" to start.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

           {showCombinedModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCombinedModal(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-elevated">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Combined Statement</h2>
              <button
                onClick={() => setShowCombinedModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Monthly Statement — Select Month
            </div>
            <input
              type="month"
              value={combinedMonth}
              onChange={(e) => setCombinedMonth(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none"
            />

                        <div className="mt-5 flex gap-2">
              <button
                onClick={() => printCombinedStatement(allEntries, allUsers, combinedMonth)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                onClick={() => { void exportCombinedSlotStatement(allEntries, allUsers, combinedMonth); }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <Download className="h-4 w-4" /> Export
              </button>
            </div>

                        <div className="mt-5 space-y-3 border-t border-border pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Full Category Statement (A/B/C/D/E/Smoking/Littering)
              </div>

              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <div className="flex gap-2">
                {(() => {
                  const opt = PERIOD_OPTIONS.find((o) => o.value === selectedPeriod)!;
                  return (
                    <>
                      <button
                        onClick={() => periodPrint(allEntries, allUsers, combinedMonth, opt.minDay, opt.maxDay, opt.label)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
                      >
                        <Printer className="h-4 w-4" /> Print
                      </button>
                      <button
                        onClick={() => periodExport(allEntries, allUsers, combinedMonth, opt.minDay, opt.maxDay, opt.label)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                      >
                        <Download className="h-4 w-4" /> Excel
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowExportModal(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-elevated">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Export Sheet</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-5 text-sm text-muted-foreground">
              Export all {rows.length} rows as a colored statement.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => printSheetStatement(rows)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                onClick={() => exportSheetToExcel(rows)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <Download className="h-4 w-4" /> Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}