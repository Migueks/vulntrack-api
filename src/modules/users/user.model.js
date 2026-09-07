const mongoose = require("mongoose");

const { USER_ROLES, USER_ROLE_VALUES } = require("../../constants/roles");

// Subdocumento opcional para almacenar el avatar del usuario en Cloudinary.
const avatarSchema = new mongoose.Schema(
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

// Modelo principal de usuario de VulnTrack.
const userSchema = new mongoose.Schema(
  {
    userCode: {
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

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: USER_ROLE_VALUES,
      default: USER_ROLES.VIEWER,
      required: true,
    },

    avatar: {
      type: avatarSchema,
      default: undefined,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    // Mongoose crea automáticamente createdAt y updatedAt.
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);

module.exports = User;
