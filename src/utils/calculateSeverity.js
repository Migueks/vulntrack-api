const {
  VULNERABILITY_SEVERITIES,
} = require("../constants/vulnerability.constants");

// Calcula la severidad automáticamente a partir de la puntuación CVSS.
const calculateSeverity = (cvssScore) => {
  if (cvssScore >= 9 && cvssScore <= 10) {
    return VULNERABILITY_SEVERITIES.CRITICAL;
  }

  if (cvssScore >= 7) {
    return VULNERABILITY_SEVERITIES.HIGH;
  }

  if (cvssScore >= 4) {
    return VULNERABILITY_SEVERITIES.MEDIUM;
  }

  if (cvssScore >= 0.1) {
    return VULNERABILITY_SEVERITIES.LOW;
  }

  throw new Error("CVSS score must be between 0.1 and 10");
};

module.exports = calculateSeverity;
