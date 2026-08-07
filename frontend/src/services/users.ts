import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./config";

export type UserRole = "admin" | "tc";
export type UserStatus = "active" | "disabled";

export interface User {
  id: string;
  name: string;
  pfNo: string;      // PF Number (alphanumeric)
  empId: string;     // legacy employee ID
  email: string;
  mobile: string;
 base: string;
  division?: string;
  tteLobbyId?: string;
  joining?: string;
  role: UserRole;
  status: UserStatus;
  lastLogin?: string;
}

export async function fetchAllUsers(): Promise<User[]> {
  const snap = await getDocs(collection(db, "users"));
  const users = snap.docs.map((d) => ({ ...(d.data() as User), id: d.id }));
  return users.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function fetchUserById(id: string): Promise<User | null> {
  const snap = await getDoc(doc(db, "users", id));
  return snap.exists() ? { ...(snap.data() as User), id: snap.id } : null;
}

export async function updateUserStatus(id: string, status: UserStatus) {
  await updateDoc(doc(db, "users", id), { status });
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  pfNo: string;
  mobile: string;
  base: string;
  division?: string;
  tteLobbyId?: string;
  joining?: string;
  role: UserRole;
}

export async function createTCUser(payload: CreateUserPayload): Promise<string> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to create user");
  }
  const data = await res.json();
  return data.uid;
}

export interface UpdateUserPayload {
  name: string;
  pfNo: string;
  mobile: string;
  base: string;
  division?: string;
  tteLobbyId?: string;
  joining?: string;
  role: UserRole;
}

export async function updateUserProfile(id: string, patch: UpdateUserPayload) {
  await updateDoc(doc(db, "users", id), { ...patch });
}
export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Failed to delete user");
  }
}