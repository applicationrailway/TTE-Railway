//sheet

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "./config";
import type { Entry } from "./entries";

export interface CaseValue {
  nc: number;   // number of cases
  amt: number;  // amount collected
}

// A Cases and B Cases have two separate rate fields (Fare + E/Fare)
export interface FareCaseValue {
  nc: number;
  fare: number;
  eFare: number;
}

export interface SheetRow {
  id?: string;
  order: number;
  base: string;
  name: string;
  wd: number; // working days
  A: FareCaseValue;
  B: FareCaseValue;
  C: CaseValue;
  D: CaseValue;
  E: CaseValue;
  smoking: CaseValue;
  litteringCases: CaseValue;
  sacking: CaseValue;
  collectorId?: string;   // links this row to the TC it was auto-generated from
  sourceMonth?: string;   // "YYYY-MM" — which month's entries this row was built from
  entryId?: string;       // links this row 1:1 to the single Entry it was built from
}

export function emptyCaseValue(): CaseValue {
  return { nc: 0, amt: 0 };
}

export function emptyFareCaseValue(): FareCaseValue {
  return { nc: 0, fare: 0, eFare: 0 };
}

export function emptySheetRow(order: number): Omit<SheetRow, "id"> {
  return {
    order,
    base: "",
    name: "",
    wd: 0,
    A: emptyFareCaseValue(),
    B: emptyFareCaseValue(),
    C: emptyCaseValue(),
    D: emptyCaseValue(),
    E: emptyCaseValue(),
    smoking: emptyCaseValue(),
    litteringCases: emptyCaseValue(),
    sacking: emptyCaseValue(),
  };
}

export async function fetchAllSheetRows(): Promise<SheetRow[]> {
  const snap = await getDocs(query(collection(db, "sheetRows"), orderBy("order", "asc")));
  return snap.docs.map((d) => {
    const data = d.data() as Partial<SheetRow>;
    return {
      id: d.id,
      order: data.order ?? 0,
      base: data.base ?? "",
      name: data.name ?? "",
      wd: data.wd ?? 0,
      A: data.A ?? emptyFareCaseValue(),
      B: data.B ?? emptyFareCaseValue(),
      C: data.C ?? emptyCaseValue(),
      D: data.D ?? emptyCaseValue(),
      E: data.E ?? emptyCaseValue(),
      smoking: data.smoking ?? emptyCaseValue(),
      litteringCases: data.litteringCases ?? emptyCaseValue(),
      sacking: data.sacking ?? emptyCaseValue(),
     collectorId: data.collectorId,
      sourceMonth: data.sourceMonth,
      entryId: data.entryId,
    } as SheetRow;
  });
}

export async function addSheetRow(row: Omit<SheetRow, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "sheetRows"), row);
  return ref.id;
}

export async function updateSheetRow(id: string, patch: Partial<Omit<SheetRow, "id">>) {
  await updateDoc(doc(db, "sheetRows", id), patch);
}

export async function deleteSheetRow(id: string) {
  await deleteDoc(doc(db, "sheetRows", id));
}

// ── Build a Sheet row from a collector's submitted entries for a given month ──
function avgPerCase(total: number, nc: number): number {
  return nc > 0 ? total / nc : 0;
}

export function buildSheetRowFromEntries(
  collector: { id: string; name: string; base?: string },
  monthEntries: Entry[],
  order: number,
): Omit<SheetRow, "id"> {
  const sum = (key: "A" | "B" | "C" | "D" | "E" | "smoking" | "litteringCases", field: "cases" | "amount") =>
    monthEntries.reduce((acc, e) => acc + (e[key]?.[field] ?? 0), 0);

  const sumField = (key: "A" | "B", field: "caseAmt" | "penaltyAmt" | "gstAmt") =>
    monthEntries.reduce((acc, e) => acc + (e[key]?.[field] ?? 0), 0);

  const aNc = sum("A", "cases");
  const bNc = sum("B", "cases");

  const aFare = avgPerCase(sumField("A", "caseAmt"), aNc);
  const aEFare = avgPerCase(sumField("A", "penaltyAmt") + sumField("A", "gstAmt"), aNc);
  const bEFare = avgPerCase(sumField("B", "penaltyAmt") + sumField("B", "gstAmt"), bNc);
  const bFare = avgPerCase(sumField("B", "caseAmt"), bNc);

  const workingDays = new Set(monthEntries.map((e) => e.date)).size;

  return {
    order,
    base: collector.base ?? "",
    name: collector.name,
    wd: workingDays,
    A: { nc: aNc, fare: aFare, eFare: aEFare },
    B: { nc: bNc, fare: bFare, eFare: bEFare },
    C: { nc: sum("C", "cases"), amt: sum("C", "amount") },
    D: { nc: sum("D", "cases"), amt: sum("D", "amount") },
    E: { nc: sum("E", "cases"), amt: sum("E", "amount") },
    smoking: { nc: sum("smoking", "cases"), amt: sum("smoking", "amount") },
    litteringCases: { nc: sum("litteringCases", "cases"), amt: sum("litteringCases", "amount") },
    sacking: emptyCaseValue(),
    collectorId: collector.id,
    sourceMonth: monthEntries[0]?.date.slice(0, 7),
  };
}
// ── Build a single Sheet row from ONE submitted entry (1 entry = 1 row) ──
export function buildSheetRowFromEntry(
  collector: { id: string; name: string; base?: string },
  entry: Entry,
  order: number,
): Omit<SheetRow, "id"> {
  const fareBreakdown = (cat: "A" | "B"): FareCaseValue => {
    const c = entry[cat];
    return {
      nc: c?.cases ?? 0,
      fare: c?.caseAmt ?? 0,
      eFare: (c?.penaltyAmt ?? 0) + (c?.gstAmt ?? 0),
    };
  };

  return {
    order,
    base: collector.base ?? entry.collectorBase ?? "",
    name: collector.name || entry.collectorName || "",
    wd: 1, // each row = one train on one date
    A: fareBreakdown("A"),
    B: fareBreakdown("B"),
    C: { nc: entry.C?.cases ?? 0, amt: entry.C?.amount ?? 0 },
    D: { nc: entry.D?.cases ?? 0, amt: entry.D?.amount ?? 0 },
    E: { nc: entry.E?.cases ?? 0, amt: entry.E?.amount ?? 0 },
    smoking: { nc: entry.smoking?.cases ?? 0, amt: entry.smoking?.amount ?? 0 },
    litteringCases: { nc: entry.litteringCases?.cases ?? 0, amt: entry.litteringCases?.amount ?? 0 },
    sacking: emptyCaseValue(),
    collectorId: collector.id,
    sourceMonth: entry.date.slice(0, 7),
    entryId: entry.id,
  };
}