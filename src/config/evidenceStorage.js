const path = require("node:path");

// Directorio privado: nunca se expondrá con express.static.
const EVIDENCE_DIR = path.resolve(__dirname, "../../storage/evidence");

const MAX_EVIDENCE_SIZE = 5 * 1024 * 1024;

const MAX_EVIDENCE_COUNT = 10;

module.exports = {
  EVIDENCE_DIR,
  MAX_EVIDENCE_SIZE,
  MAX_EVIDENCE_COUNT,
};
