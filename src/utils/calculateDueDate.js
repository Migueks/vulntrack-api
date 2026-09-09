const { SLA_DAYS } = require("../constants/sla.constants");

// Calcula la fecha límite de remediación según la prioridad del Finding.
const calculateDueDate = (priority, detectedAt = new Date()) => {
  const days = SLA_DAYS[priority];

  if (!days) {
    throw new Error("Invalid finding priority");
  }

  // Creamos una copia para no modificar la fecha recibida.
  const dueDate = new Date(detectedAt);

  if (Number.isNaN(dueDate.getTime())) {
    throw new Error("Invalid detection date");
  }

  dueDate.setDate(dueDate.getDate() + days);

  return dueDate;
};

module.exports = calculateDueDate;
