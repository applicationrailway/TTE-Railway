import { Router } from "express";
import { adminDb, adminAuth } from "../config/firebase.js";

export const router = Router();

// Health Check
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Get all TTE Entries
router.get("/entries", async (req, res, next) => {
  try {
    if (!adminDb) {
      return res
        .status(503)
        .json({ error: "Firebase Admin database not initialized" });
    }
    const snap = await adminDb
      .collection("entries")
      .orderBy("date", "desc")
      .get();
    const entries = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

// Get all complaints
router.get("/complaints", async (req, res, next) => {
  try {
    if (!adminDb) {
      return res
        .status(503)
        .json({ error: "Firebase Admin database not initialized" });
    }
    const snap = await adminDb
      .collection("complaints")
      .orderBy("number", "desc")
      .get();
    const complaints = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(complaints);
  } catch (error) {
    next(error);
  }
});

// Get all users
router.get("/users", async (req, res, next) => {
  try {
    if (!adminDb) {
      return res
        .status(503)
        .json({ error: "Firebase Admin database not initialized" });
    }
    const snap = await adminDb.collection("users").get();
    const users = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    users.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Update user status (active/disabled)
router.patch("/users/:id/status", async (req, res, next) => {
  try {
    if (!adminDb) {
      return res
        .status(503)
        .json({ error: "Firebase Admin database not initialized" });
    }
    const { id } = req.params;
    const { status } = req.body;
    if (status !== "active" && status !== "disabled") {
      return res.status(400).json({ error: "Invalid status value" });
    }
    await adminDb.collection("users").doc(id).update({ status });
    res.json({ success: true, id, status });
  } catch (error) {
    next(error);
  }
});

// Submit entries (flip draft → submitted)
router.patch("/entries/submit", async (req, res, next) => {
  try {
    if (!adminDb) return res.status(503).json({ error: "Firebase Admin database not initialized" });
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: "ids array required" });

    const batch = adminDb.batch();
    const submittedAt = new Date().toISOString();
    for (const id of ids) {
      batch.update(adminDb.collection("entries").doc(id), {
        status: "submitted",
        submittedAt,
      });
    }
    await batch.commit();
    res.json({ success: true, updated: ids.length });
  } catch (error) {
    next(error);
  }
});

// Create TC user profile (called after Firebase Auth account created client-side)
// Create TC user — Auth + Firestore in one server-side call
router.post("/users", async (req, res, next) => {
  try {
    if (!adminDb || !adminAuth)
      return res.status(503).json({ error: "Firebase Admin not initialized" });

    const { name, email, password, pfNo, mobile, base, division, tteLobbyId, joining, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "name, email and password are required" });

    // Create Auth account server-side (admin session unaffected)
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    // Write Firestore profile
    await adminDb.collection("users").doc(userRecord.uid).set({
      name,
      email,
      pfNo: pfNo ?? "",
      empId: pfNo ?? "",
      mobile: mobile ?? "",
      base: base ?? "NGP",
      division: division ?? "",
      tteLobbyId: tteLobbyId ?? "",
      joining: joining ?? new Date().toISOString().slice(0, 10),
      role: role ?? "tc",
      status: "active",
    });

    res.status(201).json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    if (error.code === "auth/email-already-exists")
      return res.status(409).json({ error: "Email already registered" });
    next(error);
  }
});

// Delete a TC user — removes both the Auth account and Firestore profile
router.delete("/users/:id", async (req, res, next) => {
  try {
    if (!adminDb || !adminAuth)
      return res.status(503).json({ error: "Firebase Admin not initialized" });

    const { id } = req.params;

    try {
      await adminAuth.deleteUser(id);
    } catch (err: any) {
      if (err.code !== "auth/user-not-found") throw err;
    }

    await adminDb.collection("users").doc(id).delete();

    res.json({ success: true, id });
  } catch (error) {
    next(error);
  }
});

// Get entries filtered by status (for admin export — submitted only)
router.get("/entries/submitted", async (req, res, next) => {
  try {
    if (!adminDb) return res.status(503).json({ error: "Firebase Admin database not initialized" });
    const { date, base } = req.query;
    let query: FirebaseFirestore.Query = adminDb
      .collection("entries")
      .where("status", "==", "submitted")
      .orderBy("date", "desc");

    if (date) query = query.where("date", "==", date);

    const snap = await query.get();
    let entries = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[];

    if (base) entries = entries.filter((e) => e.collectorBase === base);

    res.json(entries);
  } catch (error) {
    next(error);
  }
});
