import "dotenv/config";

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import aiRoutes from "./routes/ai.js";
import evidenceRoutes from "./routes/evidence.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

app.use("/generated", express.static(path.join(__dirname, "generated")));

app.use("/api/ai", aiRoutes);
app.use("/api/evidence", evidenceRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});