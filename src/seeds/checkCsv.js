const readCsv = require("./utils/readCsv");

// Comprueba que los cuatro CSV pueden leerse correctamente.
const checkCsv = async () => {
  const users = await readCsv("users.csv");

  const assets = await readCsv("assets.csv");

  const vulnerabilities = await readCsv("vulnerabilities.csv");

  const findings = await readCsv("findings.csv");

  console.log("VulnTrack CSV validation");
  console.log("------------------------");

  console.log(`Users: ${users.length}`);
  console.log(`Assets: ${assets.length}`);
  console.log(`Vulnerabilities: ${vulnerabilities.length}`);
  console.log(`Findings: ${findings.length}`);

  const total =
    users.length + assets.length + vulnerabilities.length + findings.length;

  console.log("------------------------");
  console.log(`Total records: ${total}`);

  if (
    users.length !== 12 ||
    assets.length !== 120 ||
    vulnerabilities.length !== 120 ||
    findings.length !== 300
  ) {
    throw new Error("Unexpected CSV record count.");
  }

  console.log("CSV files loaded successfully.");
};

// Muestra los errores de lectura y finaliza el proceso.
checkCsv().catch((error) => {
  console.error("CSV validation failed:", error.message);
  process.exit(1);
});
