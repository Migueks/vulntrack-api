const { test } = require("node:test");
const assert = require("node:assert/strict");

const calculateSeverity = require("../src/utils/calculateSeverity");
const calculatePriority = require("../src/utils/calculatePriority");
const calculateDueDate = require("../src/utils/calculateDueDate");

const { SLA_DAYS } = require("../src/constants/sla.constants");

const { ASSET_CRITICALITIES } = require("../src/constants/asset.constants");

const {
  VULNERABILITY_SEVERITIES,
} = require("../src/constants/vulnerability.constants");

const { FINDING_PRIORITIES } = require("../src/constants/finding.constants");

// Comprueba los límites CVSS y su severidad correspondiente.
test("CVSS severity boundaries", () => {
  const cases = [
    [0.1, "LOW"],
    [3.9, "LOW"],
    [4, "MEDIUM"],
    [6.9, "MEDIUM"],
    [7, "HIGH"],
    [8.9, "HIGH"],
    [9, "CRITICAL"],
    [10, "CRITICAL"],
  ];

  for (const [score, severity] of cases) {
    assert.equal(calculateSeverity(score), severity);
  }

  // Las puntuaciones fuera del rango deben rechazarse.
  assert.throws(() => calculateSeverity(0));
  assert.throws(() => calculateSeverity(11));
});

// Comprueba las 16 combinaciones de criticidad y severidad.
test("risk priority matrix covers all asset criticalities and severities", () => {
  const priorities = new Set(Object.values(FINDING_PRIORITIES));

  for (const asset of Object.values(ASSET_CRITICALITIES)) {
    for (const severity of Object.values(VULNERABILITY_SEVERITIES)) {
      assert.ok(priorities.has(calculatePriority(severity, asset)));
    }
  }

  // Ejemplos importantes de nuestra matriz de riesgo.
  assert.equal(calculatePriority("CRITICAL", "CRITICAL"), "P1");

  assert.equal(calculatePriority("MEDIUM", "CRITICAL"), "P2");
});

// Comprueba que los SLA mantienen la hora UTC.
test("due dates follow SLA using UTC calendar days", () => {
  const base = new Date("2026-03-28T20:00:00.000Z");

  const original = base.toISOString();

  // P1 tiene un SLA de tres días.
  assert.equal(
    calculateDueDate("P1", base).toISOString(),
    "2026-03-31T20:00:00.000Z",
  );

  // La función no debe modificar la fecha original.
  assert.equal(base.toISOString(), original);

  // Comprobamos todos los SLA definidos en VulnTrack.
  for (const [priority, days] of Object.entries(SLA_DAYS)) {
    const expected = new Date(base.getTime());

    expected.setUTCDate(expected.getUTCDate() + days);

    assert.equal(
      calculateDueDate(priority, base).toISOString(),
      expected.toISOString(),
    );
  }

  // Las prioridades inexistentes deben rechazarse.
  assert.throws(() => calculateDueDate("P0", base));
});
