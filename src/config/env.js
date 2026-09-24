/**
 * Comprueba las variables de entorno esenciales de VulnTrack.
 * Nunca muestra contraseñas ni credenciales en los mensajes de error.
 */
const validateEnv = () => {
  // Variables necesarias para MongoDB, JWT y el frontend.
  const requiredVars = ["MONGODB_URI", "JWT_SECRET", "CLIENT_ORIGIN"];

  for (const name of requiredVars) {
    if (!process.env[name]?.trim()) {
      throw new Error(`Missing environment variable: ${name}`);
    }
  }

  // Exige un secreto suficientemente largo para firmar JWT.
  if (Buffer.byteLength(process.env.JWT_SECRET, "utf8") < 32) {
    throw new Error("JWT_SECRET must contain at least 32 UTF-8 bytes.");
  }

  // Comprueba el puerto de Express.
  const port = Number(process.env.PORT || 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  // Comprueba que el origen del frontend sea una URL válida.
  let clientOrigin;

  try {
    clientOrigin = new URL(process.env.CLIENT_ORIGIN);
  } catch {
    throw new Error("CLIENT_ORIGIN must be a valid HTTP(S) origin.");
  }

  if (
    !["http:", "https:"].includes(clientOrigin.protocol) ||
    clientOrigin.origin !== process.env.CLIENT_ORIGIN
  ) {
    throw new Error(
      "CLIENT_ORIGIN must be an HTTP(S) origin without trailing slash.",
    );
  }

  // Evita configurar solo una parte de las credenciales Cloudinary.
  const cloudinaryVars = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];

  const configuredCloudinaryVars = cloudinaryVars.filter((name) =>
    process.env[name]?.trim(),
  );

  if (
    configuredCloudinaryVars.length > 0 &&
    configuredCloudinaryVars.length !== cloudinaryVars.length
  ) {
    throw new Error("Incomplete Cloudinary configuration.");
  }
};

module.exports = validateEnv;
