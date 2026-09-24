const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("./user.model");
const Finding = require("../findings/finding.model");

const ApiError = require("../../utils/ApiError");
const { USER_ROLES } = require("../../constants/roles");
const { FINDING_STATUSES } = require("../../constants/finding.constants");

// Campos permitidos en las respuestas públicas.
const PUBLIC_FIELDS =
  "userCode name email role isActive avatar lastLogin createdAt";

// Estados que representan trabajo todavía pendiente.
const ACTIVE_FINDING_STATUSES = [
  FINDING_STATUSES.OPEN,
  FINDING_STATUSES.IN_PROGRESS,
  FINDING_STATUSES.MITIGATED,
];

// Prepara la representación pública de un usuario.
const toPublicUser = (user) => ({
  id: user._id.toString(),
  userCode: user.userCode,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  avatar: user.avatar?.url || null,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
});

// Comprueba que el identificador es válido.
const validateUserId = (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid user ID.");
  }
};

// Obtiene usuarios con paginación.
const getUsers = async ({ page = 1, limit = 10 }) => {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  if (
    !Number.isInteger(parsedPage) ||
    parsedPage < 1 ||
    !Number.isInteger(parsedLimit) ||
    parsedLimit < 1 ||
    parsedLimit > 100
  ) {
    throw new ApiError(400, "Invalid pagination parameters.");
  }

  const skip = (parsedPage - 1) * parsedLimit;

  const [users, total] = await Promise.all([
    User.find()
      .select(PUBLIC_FIELDS)
      .sort({ userCode: 1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),

    User.countDocuments(),
  ]);

  return {
    users: users.map(toPublicUser),

    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  };
};

// Consulta un usuario concreto.
const getUserById = async (id) => {
  validateUserId(id);

  const user = await User.findById(id).select(PUBLIC_FIELDS).lean();

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  return toPublicUser(user);
};

// Genera el siguiente código secuencial.
const generateUserCode = async () => {
  const lastUser = await User.findOne()
    .sort({ userCode: -1 })
    .select("userCode")
    .lean();

  const lastNumber = lastUser ? Number(lastUser.userCode.split("-")[1]) : 0;

  return `USR-${String(lastNumber + 1).padStart(3, "0")}`;
};

// Crea usuarios con contraseña hasheada.
const createUser = async ({ name, email, password, role }) => {
  const existingUser = await User.exists({ email });

  if (existingUser) {
    throw new ApiError(409, "Email already registered.");
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  for (let attempt = 0; attempt < 3; attempt++) {
    const userCode = await generateUserCode();

    try {
      const user = await User.create({
        userCode,
        name,
        email,
        password: hashedPassword,
        role,
        isActive: true,
      });

      return toPublicUser(user);
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }

      if (error.keyPattern?.email) {
        throw new ApiError(409, "Email already registered.");
      }

      if (!error.keyPattern?.userCode) {
        throw new ApiError(409, "User already exists.");
      }
    }
  }

  throw new ApiError(409, "Unable to allocate a user code. Please retry.");
};

// Busca el usuario que vamos a modificar.
const findUserOrFail = async (id) => {
  validateUserId(id);

  const user = await User.findById(id);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  return user;
};

// Comprueba si existen Findings pendientes asignados.
const hasActiveFindings = async (userId) => {
  const finding = await Finding.exists({
    assignedTo: userId,
    status: {
      $in: ACTIVE_FINDING_STATUSES,
    },
  });

  return Boolean(finding);
};

// Impide dejar hallazgos pendientes bajo una cuenta no operativa.
const ensureNoActiveFindings = async (userId) => {
  if (await hasActiveFindings(userId)) {
    throw new ApiError(
      409,
      "Reassign active findings before changing this user.",
    );
  }
};

// Actualiza el nombre, email o rol de un usuario.
const updateUser = async (id, data, currentUser) => {
  const user = await findUserOrFail(id);

  // El administrador no puede modificar su propio rol.
  if (
    data.role !== undefined &&
    data.role !== user.role &&
    user._id.equals(currentUser._id)
  ) {
    throw new ApiError(409, "You cannot change your own role.");
  }

  // Un Viewer no puede conservar trabajo operativo asignado.
  if (data.role === USER_ROLES.VIEWER && user.role !== USER_ROLES.VIEWER) {
    await ensureNoActiveFindings(user._id);
  }

  if (data.email !== undefined && data.email !== user.email) {
    const existingUser = await User.exists({
      email: data.email,
      _id: { $ne: user._id },
    });

    if (existingUser) {
      throw new ApiError(409, "Email already registered.");
    }
  }

  // Solo aplicamos los campos expresamente enviados.
  if (data.name !== undefined) {
    user.name = data.name;
  }

  if (data.email !== undefined) {
    user.email = data.email;
  }

  if (data.role !== undefined) {
    user.role = data.role;
  }

  try {
    await user.save();
  } catch (error) {
    // Protege también frente a dos peticiones simultáneas.
    if (error.code === 11000 && error.keyPattern?.email) {
      throw new ApiError(409, "Email already registered.");
    }

    throw error;
  }

  return toPublicUser(user);
};

/**
 * Activa o desactiva una cuenta.
 * Cada cambio de estado invalida los JWT anteriores.
 */
const updateUserStatus = async (id, { isActive }, currentUser) => {
  const user = await findUserOrFail(id);

  // Evita que un administrador pierda su propio acceso.
  if (!isActive && user._id.equals(currentUser._id)) {
    throw new ApiError(409, "You cannot deactivate your own account.");
  }

  // Antes de desactivar, exigimos reasignar el trabajo pendiente.
  if (!isActive && user.isActive) {
    await ensureNoActiveFindings(user._id);
  }

  // Si el estado no cambia, no necesitamos invalidar sesiones.
  if (user.isActive === isActive) {
    return toPublicUser(user);
  }

  // Actualización atómica del estado y la versión de sesión.
  const result = await User.updateOne(
    {
      _id: user._id,
      isActive: user.isActive,

      // Compatibilidad con los usuarios existentes del seed.
      tokenVersion:
        (user.tokenVersion ?? 0) === 0 ? { $in: [null, 0] } : user.tokenVersion,
    },
    {
      $set: {
        isActive,
      },

      // Invalida los JWT emitidos anteriormente.
      $inc: {
        tokenVersion: 1,
      },
    },
  );

  // Evita sobrescribir cambios concurrentes.
  if (result.modifiedCount !== 1) {
    throw new ApiError(409, "Account changed during the update. Retry.");
  }

  user.isActive = isActive;

  return toPublicUser(user);
};

// Permite al usuario modificar su propio nombre o email.
const updateMe = async (userId, data) => {
  const user = await findUserOrFail(userId);

  if (data.email !== undefined && data.email !== user.email) {
    const existingUser = await User.exists({
      email: data.email,
      _id: { $ne: user._id },
    });

    if (existingUser) {
      throw new ApiError(409, "Email already registered.");
    }
  }

  if (data.name !== undefined) {
    user.name = data.name;
  }

  if (data.email !== undefined) {
    user.email = data.email;
  }

  try {
    await user.save();
  } catch (error) {
    // Mantiene la protección ante altas o cambios concurrentes.
    if (error.code === 11000 && error.keyPattern?.email) {
      throw new ApiError(409, "Email already registered.");
    }

    throw error;
  }

  return toPublicUser(user);
};

/**
 * Cambia la contraseña del usuario autenticado.
 * Invalida todos los JWT emitidos antes del cambio.
 */
const changePassword = async (userId, { currentPassword, newPassword }) => {
  // Recuperamos expresamente el hash de la contraseña.
  const user = await User.findById(userId).select("+password");

  if (!user || !user.isActive) {
    throw new ApiError(401, "Authentication required.");
  }

  // Comprueba que el usuario conoce su contraseña actual.
  const currentPasswordMatches = await bcrypt.compare(
    currentPassword,
    user.password,
  );

  if (!currentPasswordMatches) {
    throw new ApiError(400, "Current password is incorrect.");
  }

  // Impide reutilizar exactamente la misma contraseña.
  const samePassword = await bcrypt.compare(newPassword, user.password);

  if (samePassword) {
    throw new ApiError(
      400,
      "New password must be different from the current password.",
    );
  }

  // Genera el hash de la nueva contraseña.
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Actualiza contraseña y versión de sesión en una sola operación.
  const result = await User.updateOne(
    {
      _id: user._id,

      // Impide sobrescribir otra actualización de contraseña.
      password: user.password,

      // Compatibilidad con usuarios anteriores al nuevo campo.
      tokenVersion:
        (user.tokenVersion ?? 0) === 0 ? { $in: [null, 0] } : user.tokenVersion,

      isActive: true,
    },
    {
      $set: {
        password: hashedPassword,
      },

      // Invalida las sesiones anteriores.
      $inc: {
        tokenVersion: 1,
      },
    },
  );

  if (result.modifiedCount !== 1) {
    throw new ApiError(409, "Account changed during password update. Retry.");
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  updateMe,
  changePassword,
};
