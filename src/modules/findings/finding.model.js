const mongoose = require("mongoose");

const {
  FINDING_STATUSES,
  FINDING_PRIORITIES,
  FINDING_STATUS_VALUES,
  FINDING_PRIORITY_VALUES,
  FINDING_HISTORY_ACTION_VALUES,
} = require("../../constants/finding.constants");

// Evidencia adjunta a un hallazgo y almacenada físicamente en Cloudinary.
const evidenceSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true,
  },

  publicId: {
    type: String,
    required: true,
    trim: true,
  },

  originalName: {
    type: String,
    required: true,
    trim: true,
  },

  mimeType: {
    type: String,
    required: true,
    trim: true,
  },

  size: {
    type: Number,
    required: true,
    min: 0,
  },

  // Usuario que subió la evidencia.
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

// Entrada utilizada para mantener la trazabilidad de cada hallazgo.
const historyEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: FINDING_HISTORY_ACTION_VALUES,
      required: true,
    },

    fromStatus: {
      type: String,
      enum: FINDING_STATUS_VALUES,
      default: null,
    },

    toStatus: {
      type: String,
      enum: FINDING_STATUS_VALUES,
      default: null,
    },

    // Usuario responsable de realizar la acción.
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Cada entrada conserva su _id para poder identificarla si fuera necesario.
    _id: true,
  },
);

// Modelo principal que relaciona un activo con una vulnerabilidad detectada.
const findingSchema = new mongoose.Schema(
  {
    findingCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    // Activo afectado por la vulnerabilidad.
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      required: true,
    },

    // Vulnerabilidad detectada en el activo.
    vulnerability: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vulnerability",
      required: true,
    },

    // Analista responsable del hallazgo. Puede comenzar sin asignar.
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Usuario que registró originalmente el hallazgo.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: FINDING_STATUS_VALUES,
      default: FINDING_STATUSES.OPEN,
      required: true,
    },

    // Se calculará automáticamente en la lógica de negocio.
    priority: {
      type: String,
      enum: FINDING_PRIORITY_VALUES,
      default: FINDING_PRIORITIES.P4,
      required: true,
    },

    detectedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    // Se calculará según la prioridad y el SLA correspondiente.
    dueDate: {
      type: Date,
      required: true,
    },

    // Se establece únicamente cuando el hallazgo queda cerrado.
    closedAt: {
      type: Date,
      default: null,
    },

    // Justificación o explicación del cierre.
    closureNote: {
      type: String,
      trim: true,
      default: "",
    },

    evidence: {
      type: [evidenceSchema],
      default: [],
    },

    history: {
      type: [historyEntrySchema],
      default: [],
    },
  },
  {
    // Mongoose crea createdAt y updatedAt automáticamente.
    timestamps: true,
  },
);

// Índices pensados para los filtros y consultas principales de VulnTrack.
findingSchema.index({ asset: 1, status: 1 });
findingSchema.index({ assignedTo: 1, status: 1 });
findingSchema.index({ status: 1, dueDate: 1 });
findingSchema.index({ asset: 1, vulnerability: 1 });

// Impide dos Findings activos para el mismo activo y vulnerabilidad.
findingSchema.index(
  {
    asset: 1,
    vulnerability: 1,
  },
  {
    name: "unique_active_asset_vulnerability",

    unique: true,

    partialFilterExpression: {
      status: {
        $in: ["OPEN", "IN_PROGRESS", "MITIGATED"],
      },
    },
  },
);

const Finding = mongoose.model("Finding", findingSchema);

module.exports = Finding;
