import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { router as apiRouter } from "./routes/api.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());

// Main API routes
app.use("/api", apiRouter);

// Global Error Handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error" });
  },
);

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
