import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
  where,
} from "firebase/firestore";
import { db } from "./config";

export type ComplaintStatus = "Pending" | "Under Review" | "Resolved" | "Closed";
export type ComplaintPriority = "Low" | "Medium" | "High";

export interface Complaint {
  id?: string;
  collectorId: string;
  collectorName?: string;
  collectorBase?: string;
  number: number;
  category: string;
  train: string;
  station: string;
  description: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  createdAt: string;
  adminRemark?: string;
  expectedResolutionDate?: string;
}

export async function fetchMyComplaints(uid: string): Promise<Complaint[]> {
  const q = query(collection(db, "complaints"), where("collectorId", "==", uid));
  const snap = await getDocs(q);
  const complaints = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Complaint);
  return complaints.sort((a, b) => b.number - a.number);
}

export async function submitComplaint(
  complaint: Omit<Complaint, "id" | "number" | "status" | "createdAt">,
): Promise<number> {
  const number = Date.now();
  await addDoc(collection(db, "complaints"), {
    ...complaint,
    number,
    status: "Pending",
    createdAt: new Date().toISOString().slice(0, 10),
  });
  return number;
}

export async function fetchAllComplaints(): Promise<Complaint[]> {
  const snap = await getDocs(query(collection(db, "complaints"), orderBy("number", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Complaint);
}

export async function updateComplaintStatus(id: string, status: ComplaintStatus) {
  await updateDoc(doc(db, "complaints", id), { status });
}

export async function updateComplaintDetails(
  id: string,
  details: { adminRemark?: string; expectedResolutionDate?: string },
) {
  await updateDoc(doc(db, "complaints", id), details);
}
