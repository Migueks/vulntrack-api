const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { parse } = require("csv-parse/sync");

// Lee un CSV desde la carpeta de datos del seed.
const readCsv = async (fileName) => {
  const filePath = path.join(__dirname, "..", "data", fileName);

  const content = await readFile(filePath, "utf8");

  // Convierte las filas en objetos utilizando los encabezados.
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
};

module.exports = readCsv;
