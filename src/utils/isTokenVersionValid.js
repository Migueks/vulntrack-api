// Comprueba que el JWT pertenece a la versión actual de sesión.
// Los tokens anteriores a un cambio de contraseña o estado son rechazados.
const isTokenVersionValid = (payload, user) =>
  Boolean(
    user &&
    user.isActive &&
    Number.isSafeInteger(payload?.tokenVersion) &&
    payload.tokenVersion >= 0 &&
    payload.tokenVersion === (user.tokenVersion ?? 0),
  );

module.exports = isTokenVersionValid;
