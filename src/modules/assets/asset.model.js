const mongoose = require("mongoose");

const {
  ASSET_TYPES,
  ASSET_ENVIRONMENTS,
  ASSET_CRITICALITIES,
  ASSET_STATUSES,
  ASSET_TYPE_VALUES,
  ASSET_ENVIRONMENT_VALUES,
  ASSET_CRITICALITY_VALUES,
  ASSET_STATUS_VALUES,
} = require("../../constants/asset.constants");

// Subdocumento opcional para almacenar una imagen del activo en Cloudinary.
const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      trim: true,
    },

    publicId: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  },
);

// Modelo de los activos tecnológicos gestionados por VulnTrack.
const assetSchema = new mongoose.Schema(
  {
    assetCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ASSET_TYPE_VALUES,
      default: ASSET_TYPES.OTHER,
      required: true,
    },

    hostname: {
      type: String,
      trim: true,
      lowercase: true,
    },

    ipAddress: {
      type: String,
      trim: true,
    },

    operatingSystem: {
      type: String,
      trim: true,
    },

    environment: {
      type: String,
      enum: ASSET_ENVIRONMENT_VALUES,
      default: ASSET_ENVIRONMENTS.DEVELOPMENT,
      required: true,
    },

    criticality: {
      type: String,
      enum: ASSET_CRITICALITY_VALUES,
      default: ASSET_CRITICALITIES.MEDIUM,
      required: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ASSET_STATUS_VALUES,
      default: ASSET_STATUSES.ACTIVE,
      required: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    image: {
      type: imageSchema,
      default: undefined,
    },

    // Guarda qué usuario registró originalmente el activo.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    // Mongoose añade createdAt y updatedAt automáticamente.
    timestamps: true,
  },
);

// Índices útiles para los filtros que usará la aplicación.
assetSchema.index({ status: 1, criticality: 1 });
assetSchema.index({ type: 1 });
assetSchema.index({ environment: 1 });

const Asset = mongoose.model("Asset", assetSchema);

module.exports = Asset;
