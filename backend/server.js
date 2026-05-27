import "dotenv/config";

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

import createGameRoutes from "./routes/game.js";
import aiRoutes from "./routes/ai.js";
import evidenceRoutes from "./routes/evidence.js";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");
const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GENERATED_DIR = path.join(__dirname, "generated");
const EVIDENCE_IMAGE_DIR = path.join(__dirname, "public", "evidence");

for (const dir of [GENERATED_DIR, EVIDENCE_IMAGE_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

app.use("/generated", express.static(GENERATED_DIR));
app.use("/evidence", express.static(EVIDENCE_IMAGE_DIR));
app.use("/api/ai", aiRoutes);
app.use("/api/evidence", evidenceRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Mystic Master API",
    time: new Date().toISOString(),
  });
});

if (!process.env.JWT_SECRET) {
  console.warn("請在 backend/.env 設定 JWT_SECRET");
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
    return res.status(401).json({ error: "請先登入。" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "登入已過期，請重新登入。" });
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
      return res.status(400).json({ error: "請填寫郵件、用戶名稱與密碼。" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "郵件格式不正確。" });
    }

    if (userName.length < 2) {
      return res.status(400).json({ error: "用戶名稱至少需要 2 個字。" });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: "密碼至少需要 4 個字。" });
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
      return res.status(409).json({ error: "郵件或用戶名稱已經被使用。" });
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
      message: "註冊成功，請登入。",
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
      return res.status(400).json({ error: "請填寫用戶名稱或郵件與密碼。" });
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
      return res.status(401).json({ error: "郵件或密碼錯誤。" });
    }

    res.json({
      message: "登入成功。",
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
    evidenceImageDir: EVIDENCE_IMAGE_DIR,
    port: PORT,
  })
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
