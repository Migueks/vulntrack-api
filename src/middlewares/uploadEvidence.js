const multer = require("multer");

const ApiError = require("../utils/ApiError");

const { MAX_EVIDENCE_SIZE } = require("../config/evidenceStorage");

// Recibe un único archivo en memoria.
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_EVIDENCE_SIZE,
    files: 1,
  },
}).single("file");

// Gestiona los errores del formulario multipart.
const uploadEvidence = (req, res, next) => {
  upload(req, res, (error) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(413, "Evidence exceeds the 5 MB limit."));
    }

    if (error) {
      return next(new ApiError(400, "Invalid evidence upload."));
    }

    if (!req.file) {
      return next(new ApiError(400, "The file field is required."));
    }

    next();
  });
};

module.exports = uploadEvidence;
