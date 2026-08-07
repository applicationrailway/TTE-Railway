import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "./config";

// workingIn = the duty type column (SQD / LINK / stn)
export type WorkingIn = "SQD" | "LINK" | "stn";

// squadName = the unnamed team column (VIRAT / VEDANT / VIJAY / VIKRANT / VIHAN / OPEN / ALFA / BRAVO / CHARLI / TEJAS / "")
export type SquadName =
  | "VIRAT"
  | "VEDANT"
  | "VIJAY"
  | "VIKRANT"
  | "VIHAN"
  | "OPEN"
  | "ALFA"
  | "BRAVO"
  | "CHARLI"
  | "TEJAS"
  | "";

// trainStatus = when no actual train is worked (REST / LAP / CL / SCL / CCL / LEAVE / SICK / ML / STN)
export type TrainStatus =
  | "REST"
  | "LAP"
  | "CL"
  | "SCL"
  | "CCL"
  | "LEAVE"
  | "SICK"
  | "ML"
  | "STN";

export interface FineCategory {
  cases: number;
  amount: number;
  caseAmt?: number;
  penaltyAmt?: number;
  gstAmt?: number;
}

// One row in the spreadsheet = one train on one date
export interface Entry {
  id?: string;
  collectorId: string;
  collectorName?: string;
  collectorBase?: string;
  pfNo?: string;            // PF No. (alphanumeric, e.g. 39500722678 or 39513AE0201)
  date: string;             // stored as YYYY-MM-DD internally; exported as DD.MM.YY
  trainNumber: string;      // train number or status (REST / LAP / etc.)
  workingIn: WorkingIn;     // SQD | LINK | stn
  squadName: SquadName;     // VIRAT / VEDANT / OPEN / "" etc.
  A: FineCategory;
  B: FineCategory;
  C: FineCategory;
  D: FineCategory;
  E: FineCategory;
  smoking: FineCategory;
  litteringCases?: FineCategory;
  doctorFee?: number;
 totalCases: number;
  totalAmount: number;
  status: "draft" | "submitted"; // draft = saved but not submitted; submitted = sent to admin
  createdAt?: Timestamp;
  submittedAt?: Timestamp;
  edited?: boolean; // true once the TC has used their one allowed edit
  adminRemark?: string; // remark added by admin, not visible/editable by TC
  flagged?: boolean; // true if admin has starred/flagged this entry as important
}

export async function fetchMyEntries(uid: string): Promise<Entry[]> {
  const q = query(collection(db, "entries"), where("collectorId", "==", uid));
  const snap = await getDocs(q);
  const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry);
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveDraftEntry(entry: Omit<Entry, "id" | "createdAt" | "submittedAt">): Promise<string> {
  const ref = await addDoc(collection(db, "entries"), {
    ...entry,
    status: "draft",
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateDraftEntry(id: string, entry: Partial<Omit<Entry, "id" | "createdAt">>) {
  await updateDoc(doc(db, "entries", id), entry);
}

export async function submitEntries(ids: string[]) {
  const submittedAt = Timestamp.now();
  await Promise.all(
    ids.map((id) => updateDoc(doc(db, "entries", id), { status: "submitted", submittedAt }))
  );
}

export async function fetchAllEntries(): Promise<Entry[]> {
  const snap = await getDocs(query(collection(db, "entries"), orderBy("date", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry);
}
export async function updateAdminRemark(id: string, remark: string) {
  await updateDoc(doc(db, "entries", id), { adminRemark: remark });
}

export async function toggleEntryFlag(id: string, flagged: boolean) {
  await updateDoc(doc(db, "entries", id), { flagged });
}

export async function deleteEntry(id: string) {
  await deleteDoc(doc(db, "entries", id));
}