const {
  VULNERABILITY_SEVERITIES,
} = require("../constants/vulnerability.constants");

// Calcula la severidad automáticamente a partir de la puntuación CVSS.
const calculateSeverity = (cvssScore) => {
  // Rechaza puntuaciones inválidas antes de clasificarlas.
  if (!Number.isFinite(cvssScore) || cvssScore < 0.1 || cvssScore > 10) {
    throw new Error("CVSS score must be between 0.1 and 10");
  }

  if (cvssScore >= 9) {
    return VULNERABILITY_SEVERITIES.CRITICAL;
  }

  if (cvssScore >= 7) {
    return VULNERABILITY_SEVERITIES.HIGH;
  }

  if (cvssScore >= 4) {
    return VULNERABILITY_SEVERITIES.MEDIUM;
  }

  return VULNERABILITY_SEVERITIES.LOW;
};

module.exports = calculateSeverity;
