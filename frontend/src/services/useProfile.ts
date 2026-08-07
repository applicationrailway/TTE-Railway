import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./config";

export interface UserProfile {
  name: string;
  email: string;
  role: "admin" | "tc";
  base: string;
  mobile: string;
  pfNo?: string;
  employee_id?: string;
  joining?: string;
  status?: "active" | "disabled";
  lastLogin?: string;
  dutyStatus?: string;
  dutyStatusSetAt?: string;
}

export async function fetchProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function createDefaultProfile(uid: string, email: string): Promise<UserProfile> {
  const isAdmin = email.toLowerCase().includes("admin");
  const role = isAdmin ? "admin" : "tc";
  const name = isAdmin
    ? "Divisional Admin"
    : email
        .split("@")[0]
        .split(".")[0]
        .replace(/^\w/, (c) => c.toUpperCase());

  const defaultProfile: UserProfile = {
    name: name || "Ticket Collector",
    email: email,
    role: role,
    base: "NGP",
    mobile: "",
    pfNo: "",
    status: "active",
  };

  await setDoc(doc(db, "users", uid), defaultProfile);
  return defaultProfile;
}

export async function updateDutyStatus(uid: string, status: string): Promise<void> {
  await setDoc(
    doc(db, "users", uid),
    { dutyStatus: status, dutyStatusSetAt: new Date().toISOString() },
    { merge: true },
  );
}

export async function updateLastLogin(uid: string): Promise<void> {
  try {
    await setDoc(doc(db, "users", uid), { lastLogin: new Date().toISOString() }, { merge: true });
  } catch {
    // silent fail — don't block login flow if this fails
  }
}