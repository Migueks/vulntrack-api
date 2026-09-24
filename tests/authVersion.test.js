const { test } = require("node:test");
const assert = require("node:assert/strict");

const isTokenVersionValid = require("../src/utils/isTokenVersionValid");

// Comprueba que un token con la versión actual es válido.
test("accepts tokens with the current session version", () => {
  const user = {
    isActive: true,
    tokenVersion: 2,
  };

  const payload = {
    tokenVersion: 2,
  };

  assert.equal(isTokenVersionValid(payload, user), true);
});

// Los tokens anteriores a un cambio de contraseña se rechazan.
test("rejects outdated token versions", () => {
  const user = {
    isActive: true,
    tokenVersion: 3,
  };

  assert.equal(isTokenVersionValid({ tokenVersion: 2 }, user), false);

  assert.equal(isTokenVersionValid({ tokenVersion: 0 }, user), false);
});

// Una cuenta desactivada no puede utilizar sus tokens.
test("rejects tokens from inactive or missing users", () => {
  const inactiveUser = {
    isActive: false,
    tokenVersion: 1,
  };

  assert.equal(isTokenVersionValid({ tokenVersion: 1 }, inactiveUser), false);

  assert.equal(isTokenVersionValid({ tokenVersion: 1 }, null), false);
});

// Rechaza tokens que no tengan una versión numérica válida.
test("rejects missing or invalid token versions", () => {
  const user = {
    isActive: true,
    tokenVersion: 0,
  };

  const invalidVersions = [undefined, null, -1, 0.5, "0", NaN, Infinity];

  for (const tokenVersion of invalidVersions) {
    assert.equal(isTokenVersionValid({ tokenVersion }, user), false);
  }

  // Compatibilidad con usuarios antiguos sin tokenVersion en MongoDB.
  assert.equal(
    isTokenVersionValid({ tokenVersion: 0 }, { isActive: true }),
    true,
  );
});
