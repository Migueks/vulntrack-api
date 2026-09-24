const { test } = require("node:test");
const assert = require("node:assert/strict");

const validateEnv = require("../src/config/env");

// Variables que modificaremos temporalmente durante las pruebas.
const ENV_KEYS = [
  "MONGODB_URI",
  "JWT_SECRET",
  "CLIENT_ORIGIN",
  "PORT",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

// Ejecuta una prueba con variables ficticias y restaura las originales.
const withTestEnv = (overrides, callback) => {
  const previous = {};

  // Guardamos la configuración anterior.
  for (const key of ENV_KEYS) {
    previous[key] = process.env[key];
  }

  try {
    // Configuración válida utilizada como punto de partida.
    const testEnv = {
      MONGODB_URI: "mongodb://localhost:27017/vulntrack_test",
      JWT_SECRET: "x".repeat(32),
      CLIENT_ORIGIN: "http://localhost:5173",
      PORT: "3000",
      ...overrides,
    };

    // Evitamos utilizar las credenciales reales de Cloudinary.
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }

    // Aplicamos las variables ficticias.
    for (const [key, value] of Object.entries(testEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }

    callback();
  } finally {
    // Restauramos siempre el entorno original.
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
};

// Comprueba que la configuración básica es válida.
test("accepts valid environment configuration", () => {
  withTestEnv({}, () => {
    assert.doesNotThrow(() => validateEnv());
  });
});

// La conexión de MongoDB es obligatoria.
test("rejects missing MongoDB URI", () => {
  withTestEnv(
    {
      MONGODB_URI: undefined,
    },
    () => {
      assert.throws(
        () => validateEnv(),
        /Missing environment variable: MONGODB_URI/,
      );
    },
  );
});

// El secreto JWT debe tener una longitud mínima.
test("rejects weak JWT secrets", () => {
  withTestEnv(
    {
      JWT_SECRET: "short-secret",
    },
    () => {
      assert.throws(
        () => validateEnv(),
        /JWT_SECRET must contain at least 32 UTF-8 bytes/,
      );
    },
  );
});

// Express no debe arrancar con un puerto inválido.
test("rejects invalid server ports", () => {
  for (const port of ["0", "65536", "invalid"]) {
    withTestEnv(
      {
        PORT: port,
      },
      () => {
        assert.throws(() => validateEnv(), /PORT must be an integer/);
      },
    );
  }
});

// El origen del frontend debe ser HTTP o HTTPS.
test("rejects invalid frontend origins", () => {
  const invalidOrigins = [
    "not-a-url",
    "ftp://localhost:5173",
    "http://localhost:5173/",
    "http://localhost:5173/dashboard",
  ];

  for (const origin of invalidOrigins) {
    withTestEnv(
      {
        CLIENT_ORIGIN: origin,
      },
      () => {
        assert.throws(() => validateEnv(), /CLIENT_ORIGIN must be/);
      },
    );
  }
});

// No debemos configurar únicamente una parte de Cloudinary.
test("rejects incomplete Cloudinary configuration", () => {
  withTestEnv(
    {
      CLOUDINARY_CLOUD_NAME: "test-cloud",
    },
    () => {
      assert.throws(() => validateEnv(), /Incomplete Cloudinary configuration/);
    },
  );
});

// Una configuración completa de Cloudinary debe aceptarse.
test("accepts complete Cloudinary configuration", () => {
  withTestEnv(
    {
      CLOUDINARY_CLOUD_NAME: "test-cloud",
      CLOUDINARY_API_KEY: "test-api-key",
      CLOUDINARY_API_SECRET: "test-api-secret",
    },
    () => {
      assert.doesNotThrow(() => validateEnv());
    },
  );
});
