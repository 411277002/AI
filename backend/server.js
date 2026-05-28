import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

import createGameRoutes from "./routes/game.js";
import createAiRoutes from "./routes/ai.js";
import createEvidenceRoutes from "./routes/evidence.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");
const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3001;

const GENERATED_DIR = path.join(__dirname, "generated");
const CASE_ASSET_DIR = path.join(__dirname, "public", "cases");

for (const dir of [GENERATED_DIR, CASE_ASSET_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

app.use("/generated", express.static(GENERATED_DIR));
app.use("/cases", express.static(CASE_ASSET_DIR));
app.use("/api/ai", createAiRoutes({ prisma }));
app.use("/api/evidence", createEvidenceRoutes({ prisma }));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Mystic Master API",
    time: new Date().toISOString(),
  });
});

if (!process.env.JWT_SECRET) {
  console.warn("�Цb backend/.env �]�w JWT_SECRET");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUserName(userName) {
  return String(userName || "").trim();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto
    .pbkdf2Sync(String(password), salt, 100000, 64, "sha512")
    .toString("hex");

  return { salt, hash };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(user.passwordHash, "hex")
  );
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    userName: user.userName,
  };
}

function signToken(user) {
  return jwt.sign(publicUser(user), process.env.JWT_SECRET, {
    expiresIn: "2h",
  });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return res.status(401).json({ error: "�Х��n�J�C" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "�n�J�w�L���A�Э��s�n�J�C" });
    }

    req.user = user;
    next();
  });
}

app.post("/api/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const userName = normalizeUserName(req.body?.userName);
    const password = String(req.body?.password || "");

    if (!email || !userName || !password) {
      return res.status(400).json({ error: "�ж��g�l���B�Τ��W�ٻP�K�X�C" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "�l���榡�����T�C" });
    }

    if (userName.length < 2) {
      return res.status(400).json({ error: "�Τ��W�٦ܤֻݭn 2 �Ӧr�C" });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: "�K�X�ܤֻݭn 4 �Ӧr�C" });
    }

    const duplicated = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { userName: { equals: userName, mode: "insensitive" } },
        ],
      },
    });

    if (duplicated) {
      return res.status(409).json({ error: "�l���ΥΤ��W�٤w�g�Q�ϥΡC" });
    }

    const { salt, hash } = hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        userName,
        passwordSalt: salt,
        passwordHash: hash,
      },
    });

    res.status(201).json({
      message: "���U���\�A�еn�J�C",
      user: publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const account = String(req.body?.account || req.body?.email || "").trim();
    const password = String(req.body?.password || "");

    if (!account || !password) {
      return res.status(400).json({ error: "�ж��g�Τ��W�٩ζl���P�K�X�C" });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizeEmail(account) },
          { userName: { equals: account, mode: "insensitive" } },
        ],
      },
    });

    if (!user || !verifyPassword(password, user)) {
      return res.status(401).json({ error: "�l���αK�X���~�C" });
    }

    res.json({
      message: "�n�J���\�C",
      user: publicUser(user),
      token: signToken(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(
  "/api",
  createGameRoutes({
    authenticateToken,
    generatedDir: GENERATED_DIR,
    caseAssetDir: CASE_ASSET_DIR,
    prisma,
    port: PORT,
  })
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});


