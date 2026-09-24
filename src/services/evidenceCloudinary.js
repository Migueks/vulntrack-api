const { randomUUID } = require("node:crypto");

const cloudinary = require("../config/cloudinary");

const ApiError = require("../utils/ApiError");

// Formatos admitidos por las evidencias de VulnTrack.
const ALLOWED_EXTENSIONS = ["png", "jpg", "webp", "pdf"];

// Comprueba que las credenciales están configuradas.
const ensureConfigured = () => {
  const required = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];

  for (const name of required) {
    if (!process.env[name]) {
      throw new Error(`Missing Cloudinary configuration: ${name}`);
    }
  }
};

// Sube un archivo privado directamente desde un Buffer.
const uploadPrivateEvidence = async (buffer, extension) => {
  ensureConfigured();

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new ApiError(400, "Unsupported evidence format.");
  }

  const publicId = randomUUID();

  return new Promise((resolve, reject) => {
    // Cloudinary recibe el archivo mediante un stream.
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "vulntrack/evidence",

        public_id: publicId,

        resource_type: "image",

        type: "authenticated",

        overwrite: false,
      },

      (error, result) => {
        if (error) {
          // Registra información del rechazo sin mostrar credenciales.
          console.error("Cloudinary upload rejected:", {
            name: error.name,
            message: error.message,
            httpCode: error.http_code ?? error.httpCode,
          });

          return reject(error);
        }

        if (!result?.public_id) {
          return reject(
            new Error("Cloudinary returned an invalid upload result."),
          );
        }

        resolve({
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );

    stream.on("error", reject);

    // Envía el contenido previamente validado.
    stream.end(buffer);
  });
};

// Genera una descarga temporal y recupera el archivo.
const downloadPrivateEvidence = async (publicId, extension) => {
  ensureConfigured();

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new ApiError(400, "Unsupported evidence format.");
  }

  // La URL firmada solo se utiliza dentro del backend.
  const signedUrl = cloudinary.utils.private_download_url(publicId, extension, {
    resource_type: "image",

    type: "authenticated",

    expires_at: Math.floor(Date.now() / 1000) + 60,

    attachment: true,
  });

  // Node.js 22 permite utilizar fetch sin instalar Axios.
  const response = await fetch(signedUrl, {
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Cloudinary download failed: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
};

// Elimina un recurso autenticado de Cloudinary.
const deletePrivateEvidence = async (publicId) => {
  ensureConfigured();

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",

    type: "authenticated",

    invalidate: true,
  });

  if (!["ok", "not found"].includes(result?.result)) {
    throw new Error("Cloudinary evidence deletion failed.");
  }

  return result;
};

module.exports = {
  uploadPrivateEvidence,
  downloadPrivateEvidence,
  deletePrivateEvidence,
};
