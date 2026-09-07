// Roles disponibles para los usuarios de VulnTrack.
const USER_ROLES = {
  ADMIN: "ADMIN",
  ANALYST: "ANALYST",
  VIEWER: "VIEWER",
};

// Array reutilizable para validaciones y enums de Mongoose.
const USER_ROLE_VALUES = Object.values(USER_ROLES);

module.exports = {
  USER_ROLES,
  USER_ROLE_VALUES,
};
