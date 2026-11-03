(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./exceljs.min.js"));
  else root.TallerExcel = factory(root.ExcelJS);
})(typeof globalThis !== "undefined" ? globalThis : this, function (ExcelJS) {
  "use strict";
  const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  let loading;
  async function library() {
    if (ExcelJS?.Workbook) return ExcelJS;
    if (!loading) loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/exceljs.min.js";
      script.onload = () => {
        ExcelJS = globalThis.ExcelJS;
        if (ExcelJS?.Workbook) resolve(ExcelJS);
        else { loading = null; script.remove(); reject(new Error("No se pudo cargar el generador de Excel.")); }
      };
      script.onerror = () => { loading = null; script.remove(); reject(new Error("No se pudo cargar el generador de Excel. Revisa la conexión y reintenta.")); };
      document.head.appendChild(script);
    });
    return loading;
  }
  // Las fechas de Excel no tienen zona horaria: guardar la hora del taller en Bogotá.
  function date(value) {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(value + "T00:00:00.000Z");
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("Fecha inválida en la exportación.");
      return parsed;
    }
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) throw new Error("Fecha inválida en la exportación.");
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(parsed).map(x => [x.type, x.value]));
    return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second));
  }
  function format(heading, value) {
    if (value instanceof Date) return heading === "Fecha gasto" ? "dd/mm/yyyy" : "dd/mm/yyyy hh:mm:ss";
    if (typeof value !== "number") return "@";
    if (/^ID$/i.test(heading)) return "0";
    if (/\bFino g\b/i.test(heading)) return "[$-es-CO]#,##0.000000";
    if (/\bg\b/i.test(heading)) return "[$-es-CO]#,##0.000";
    return "[$-es-CO]#,##0.00";
  }
  async function write(sheetName, headers, rows, metadata = {}) {
    await library();
    if (!Array.isArray(headers) || !headers.length || !Array.isArray(rows)) throw new Error("Datos de exportación inválidos.");
    if (headers.length > 16384 || rows.length > 1048575) throw new Error("Los datos superan el tamaño de una hoja de Excel. Reduce el período de exportación.");
    const book = new ExcelJS.Workbook();
    book.creator = "Áurea Taller";
    book.subject = metadata.workshop || "Taller joyero";
    book.title = sheetName;
    book.created = new Date();
    const sheet = book.addWorksheet(sheetName.replace(/[\\/*?:\[\]]/g, " ").slice(0, 31), {
      views: [{ state: "frozen", ySplit: 1 }], properties: { defaultRowHeight: 18 },
    });
    sheet.columns = headers.map(header => ({ header, width: Math.min(45, Math.max(17, header.length + 3)) }));
    for (const values of rows) {
      if (!Array.isArray(values) || values.length !== headers.length) throw new Error("Columnas incompletas en la exportación.");
      const normalized = values.map(value => {
        if (value == null) return null;
        if (value instanceof Date) { if (!Number.isFinite(value.getTime())) throw new Error("Fecha inválida en la exportación."); return value; }
        if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Número inválido en la exportación."); return value; }
        if (typeof value !== "string" && typeof value !== "boolean") throw new Error("Tipo de dato inválido en la exportación.");
        if (typeof value === "string" && value.length > 32767) throw new Error("Una celda supera el límite de texto de Excel. Reduce el detalle del registro.");
        return value;
      });
      const row = sheet.addRow(normalized);
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        // Asignar cadenas como texto conserva ceros iniciales y evita ejecutar fórmulas.
        cell.numFmt = format(headers[column - 1], normalized[column - 1]);
        cell.alignment = { vertical: "top", wrapText: true };
      });
    }
    sheet.getRow(1).eachCell(cell => {
      cell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF163E35" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    sheet.getRow(1).height = 32;
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: headers.length } };
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    sheet.pageSetup.printTitlesRow = "1:1";
    return book.xlsx.writeBuffer();
  }
  return { MIME, date, write };
});
