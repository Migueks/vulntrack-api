const { FINDING_PRIORITIES } = require("./finding.constants");

// Días máximos de remediación establecidos para cada prioridad.
const SLA_DAYS = {
  [FINDING_PRIORITIES.P1]: 3,
  [FINDING_PRIORITIES.P2]: 7,
  [FINDING_PRIORITIES.P3]: 30,
  [FINDING_PRIORITIES.P4]: 90,
};

module.exports = {
  SLA_DAYS,
};
