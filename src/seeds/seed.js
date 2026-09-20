require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const path = require("node:path");
const { mkdir, writeFile } = require("node:fs/promises");

const connectDB = require("../config/database");
const readCsv = require("./utils/readCsv");

const User = require("../modules/users/user.model");
const Asset = require("../modules/assets/asset.model");
const Vulnerability = require("../modules/vulnerabilities/vulnerability.model");
const Finding = require("../modules/findings/finding.model");

const severityUtils = require("../utils/calculateSeverity");
const priorityUtils = require("../utils/calculatePriority");
const dueDateUtils = require("../utils/calculateDueDate");

// Admite ambas formas habituales de exportar nuestras funciones.
const calculateSeverity = severityUtils.calculateSeverity ?? severityUtils;

const calculatePriority = priorityUtils.calculatePriority ?? priorityUtils;

const calculateDueDate = dueDateUtils.calculateDueDate ?? dueDateUtils;

const CLOSED_STATUSES = ["RESOLVED", "ACCEPTED_RISK", "FALSE_POSITIVE"];

// Convierte los booleanos del CSV sin aceptar valores inesperados.
const parseBoolean = (value) => {
  const normalized = String(value).trim().toUpperCase();

  if (normalized === "TRUE") return true;
  if (normalized === "FALSE") return false;

  throw new Error(`Invalid boolean value: ${value}`);
};

// Convierte fechas ISO del CSV en objetos Date.
const parseDate = (value) => {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid date: ${value}`);
  }

  return date;
};

// Obtiene un ObjectId asociado a un código de nuestro Excel.
const getId = (map, code, field) => {
  const id = map.get(code);

  if (!id) {
    throw new Error(`Unknown ${field}: ${code}`);
  }

  return id;
};

// Evita ejecutar un seed con una configuración peligrosa.
const validateEnvironment = () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed cannot run in production.");
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing.");
  }

  if (
    !process.env.SEED_DEMO_PASSWORD ||
    process.env.SEED_DEMO_PASSWORD.length < 12
  ) {
    throw new Error("SEED_DEMO_PASSWORD must contain at least 12 characters.");
  }
};

// Comprueba que no vamos a sobrescribir una base de datos existente.
const ensureEmptyCollections = async () => {
  const models = [User, Asset, Vulnerability, Finding];

  for (const Model of models) {
    const count = await Model.countDocuments();

    if (count > 0) {
      throw new Error(
        `${Model.modelName} already contains ${count} documents. Seed aborted.`,
      );
    }
  }
};

// Comprueba códigos y relaciones antes de empezar a insertar.
const validateSourceData = (rows) => {
  const expected = {
    users: 12,
    assets: 120,
    vulnerabilities: 120,
    findings: 300,
  };

  for (const [name, count] of Object.entries(expected)) {
    if (rows[name].length !== count) {
      throw new Error(`Unexpected number of ${name}.`);
    }
  }

  const users = new Set(rows.users.map((row) => row.userCode));
  const assets = new Map(rows.assets.map((row) => [row.assetCode, row]));
  const vulnerabilities = new Map(
    rows.vulnerabilities.map((row) => [row.vulnerabilityCode, row]),
  );

  const activePairs = new Set();

  for (const row of rows.assets) {
    if (!users.has(row.createdByCode)) {
      throw new Error(`Invalid asset creator: ${row.assetCode}`);
    }
  }

  for (const row of rows.vulnerabilities) {
    if (!users.has(row.createdByCode)) {
      throw new Error(
        `Invalid vulnerability creator: ${row.vulnerabilityCode}`,
      );
    }
  }

  for (const row of rows.findings) {
    const asset = assets.get(row.assetCode);
    const vulnerability = vulnerabilities.get(row.vulnerabilityCode);

    if (!asset || !vulnerability) {
      throw new Error(
        `Invalid asset/vulnerability reference: ${row.findingCode}`,
      );
    }

    if (
      !users.has(row.createdByCode) ||
      (row.assignedToCode && !users.has(row.assignedToCode))
    ) {
      throw new Error(`Invalid user reference: ${row.findingCode}`);
    }

    const closed = CLOSED_STATUSES.includes(row.status);

    if (closed !== Boolean(row.closedAt && row.closureNote)) {
      throw new Error(`Invalid closure data: ${row.findingCode}`);
    }

    const detectedAt = parseDate(row.detectedAt);
    const publishedAt = parseDate(vulnerability.publishedAt);
    const closedAt = parseDate(row.closedAt);

    if (publishedAt && publishedAt > detectedAt) {
      throw new Error(
        `Vulnerability published after detection: ${row.findingCode}`,
      );
    }

    if (closedAt && closedAt < detectedAt) {
      throw new Error(`Closure before detection: ${row.findingCode}`);
    }

    if (!closed) {
      if (
        asset.status === "DECOMMISSIONED" ||
        vulnerability.status === "ARCHIVED"
      ) {
        throw new Error(`Invalid active finding lifecycle: ${row.findingCode}`);
      }

      const pair = `${row.assetCode}:${row.vulnerabilityCode}`;

      if (activePairs.has(pair)) {
        throw new Error(`Duplicate active finding: ${row.findingCode}`);
      }

      activePairs.add(pair);
    }
  }
};

// Crea usuarios y guarda la equivalencia código → ObjectId.
const seedUsers = async (rows) => {
  const users = [];

  for (const row of rows) {
    // Cada usuario recibe un hash con su propia sal.
    const password = await bcrypt.hash(process.env.SEED_DEMO_PASSWORD, 12);

    users.push({
      userCode: row.userCode,
      name: row.name,
      email: row.email,
      password,
      role: row.role,
      isActive: parseBoolean(row.isActive),
    });
  }

  const created = await User.insertMany(users);

  return new Map(created.map((user) => [user.userCode, user._id]));
};

// Crea activos relacionándolos con los usuarios.
const seedAssets = async (rows, userIds) => {
  const documents = rows.map((row) => ({
    assetCode: row.assetCode,
    name: row.name,
    type: row.type,
    hostname: row.hostname || undefined,
    ipAddress: row.ipAddress || undefined,
    operatingSystem: row.operatingSystem || undefined,
    environment: row.environment,
    criticality: row.criticality,
    department: row.department,
    status: row.status,
    description: row.description || "",
    createdBy: getId(userIds, row.createdByCode, "asset creator"),
  }));

  const created = await Asset.insertMany(documents);

  return new Map(created.map((asset) => [asset.assetCode, asset]));
};

// Crea vulnerabilidades calculando su severidad desde CVSS.
const seedVulnerabilities = async (rows, userIds) => {
  const documents = rows.map((row) => {
    const cvssScore = Number(row.cvssScore);

    if (!Number.isFinite(cvssScore) || cvssScore < 0.1 || cvssScore > 10) {
      throw new Error(`Invalid CVSS score: ${row.vulnerabilityCode}`);
    }

    return {
      vulnerabilityCode: row.vulnerabilityCode,
      cveId: row.cveId || null,
      title: row.title,
      description: row.description,
      cvssScore,
      severity: calculateSeverity(cvssScore),
      category: row.category,
      remediation: row.remediation,
      exploitAvailable: parseBoolean(row.exploitAvailable),
      publishedAt: parseDate(row.publishedAt),
      status: row.status,
      createdBy: getId(userIds, row.createdByCode, "vulnerability creator"),
    };
  });

  const created = await Vulnerability.insertMany(documents);

  return new Map(
    created.map((vulnerability) => [
      vulnerability.vulnerabilityCode,
      vulnerability,
    ]),
  );
};

// Genera un historial sintético coherente con el workflow.
const buildHistory = (
  row,
  createdBy,
  assignedTo,
  adminId,
  detectedAt,
  closedAt,
) => {
  const history = [
    {
      action: "CREATED",
      performedBy: createdBy,
      note: "Imported from the initial CSV dataset.",
      date: detectedAt,
    },
  ];

  if (assignedTo) {
    history.push({
      action: "ASSIGNED",
      performedBy:
        String(createdBy) === String(assignedTo) ? createdBy : adminId,
      note: "Initial finding assignment.",
      date: detectedAt,
    });
  }

  const transition = (fromStatus, toStatus, performedBy, date, note = "") => {
    history.push({
      action: "STATUS_CHANGED",
      fromStatus,
      toStatus,
      performedBy,
      note,
      date,
    });
  };

  if (["IN_PROGRESS", "MITIGATED", "RESOLVED"].includes(row.status)) {
    transition("OPEN", "IN_PROGRESS", assignedTo || adminId, detectedAt);
  }

  if (["MITIGATED", "RESOLVED"].includes(row.status)) {
    transition("IN_PROGRESS", "MITIGATED", assignedTo || adminId, detectedAt);
  }

  if (row.status === "RESOLVED") {
    transition(
      "MITIGATED",
      "RESOLVED",
      assignedTo || adminId,
      closedAt,
      row.closureNote,
    );
  }

  if (["ACCEPTED_RISK", "FALSE_POSITIVE"].includes(row.status)) {
    transition("OPEN", row.status, adminId, closedAt, row.closureNote);
  }

  return history;
};

// Crea los Findings y aplica las reglas de negocio.
const seedFindings = async (rows, userIds, assetMap, vulnerabilityMap) => {
  const adminId = getId(userIds, "USR-001", "admin");

  const documents = rows.map((row) => {
    const asset = assetMap.get(row.assetCode);

    const vulnerability = vulnerabilityMap.get(row.vulnerabilityCode);

    const createdBy = getId(userIds, row.createdByCode, "finding creator");

    const assignedTo = row.assignedToCode
      ? getId(userIds, row.assignedToCode, "assigned analyst")
      : null;

    const detectedAt = parseDate(row.detectedAt);
    const closedAt = parseDate(row.closedAt);

    const priority = calculatePriority(
      vulnerability.severity,
      asset.criticality,
    );

    return {
      findingCode: row.findingCode,
      asset: asset._id,
      vulnerability: vulnerability._id,
      assignedTo,
      createdBy,
      status: row.status,
      priority,
      detectedAt,
      dueDate: calculateDueDate(priority, detectedAt),
      closedAt,
      closureNote: row.closureNote || "",
      evidence: [],
      history: buildHistory(
        row,
        createdBy,
        assignedTo,
        adminId,
        detectedAt,
        closedAt,
      ),
    };
  });

  return Finding.insertMany(documents);
};

// Guarda un informe sin contraseñas ni otros secretos.
const saveReport = async (counts) => {
  const reportsPath = path.join(__dirname, "reports");

  await mkdir(reportsPath, { recursive: true });

  const report = {
    project: "VulnTrack",
    generatedAt: new Date().toISOString(),
    database: mongoose.connection.name,
    counts,
  };

  await writeFile(
    path.join(reportsPath, "seed-report.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );
};

// Coordina la importación en orden para mantener las relaciones.
const seed = async () => {
  validateEnvironment();

  console.log("Reading VulnTrack CSV files...");

  const rows = {
    users: await readCsv("users.csv"),
    assets: await readCsv("assets.csv"),
    vulnerabilities: await readCsv("vulnerabilities.csv"),
    findings: await readCsv("findings.csv"),
  };

  validateSourceData(rows);

  await connectDB();

  // Verifica el nombre real de la base de datos conectada.
  if (mongoose.connection.name !== "vulntrack") {
    throw new Error(`Unexpected database: ${mongoose.connection.name}`);
  }

  await ensureEmptyCollections();

  console.log("Creating users...");
  const userIds = await seedUsers(rows.users);

  console.log("Creating assets...");
  const assetMap = await seedAssets(rows.assets, userIds);

  console.log("Creating vulnerabilities...");
  const vulnerabilityMap = await seedVulnerabilities(
    rows.vulnerabilities,
    userIds,
  );

  console.log("Creating findings...");
  const findings = await seedFindings(
    rows.findings,
    userIds,
    assetMap,
    vulnerabilityMap,
  );

  const counts = {
    users: userIds.size,
    assets: assetMap.size,
    vulnerabilities: vulnerabilityMap.size,
    findings: findings.length,
  };

  await saveReport(counts);

  console.log("----------------------------");
  console.log("VulnTrack seed completed.");
  console.table(counts);
};

// Cierra la conexión tanto si termina bien como si falla.
seed()
  .catch((error) => {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
