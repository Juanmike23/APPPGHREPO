/*
 * PGH-DOC
 * File: src/Variables/utils/excelWorkbook.js
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

let excelJsModulePromise;

const loadExcelJs = async () => {
  if (!excelJsModulePromise) {
    excelJsModulePromise = import("exceljs").then(
      (module) => module.default ?? module,
    );
  }

  return excelJsModulePromise;
};

export const numberToExcelColumn = (num) => {
  let column = "";
  let next = num;

  while (next > 0) {
    const remainder = (next - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    next = Math.floor((next - 1) / 26);
  }

  return column;
};

const normalizeExcelCellValue = (value, depth = 0) => {
  if (depth > 4) return "";
  if (value == null) return "";

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeExcelCellValue(item, depth + 1)).join(" ");
  }

  if (typeof value === "object") {
    if (value.master?.value !== undefined) {
      return normalizeExcelCellValue(value.master.value, depth + 1);
    }

    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part?.text || "").join("");
    }

    if (value.formula) {
      return normalizeExcelCellValue(
        value.result !== undefined ? value.result : `=${value.formula}`,
        depth + 1,
      );
    }

    if (value.hyperlink) {
      return value.text || value.hyperlink;
    }

    if (value.text !== undefined) {
      return normalizeExcelCellValue(value.text, depth + 1);
    }

    if (value.result !== undefined) {
      return normalizeExcelCellValue(value.result, depth + 1);
    }

    if (value.error) {
      return String(value.error);
    }
  }

  return String(value);
};

export const parseExcelWorkbookWithSheets = async (arrayBuffer) => {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheets = {};

  workbook.worksheets.forEach((worksheet) => {
    let maxColumns = 0;
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      maxColumns = Math.max(maxColumns, row.cellCount, row.actualCellCount);
    });

    if (maxColumns <= 0) {
      return;
    }

    const headers = Array.from({ length: maxColumns }, (_, index) =>
      numberToExcelColumn(index + 1),
    );

    const rawRows = [];
    for (let rowIndex = 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      const values = [];

      for (let columnIndex = 1; columnIndex <= maxColumns; columnIndex += 1) {
        values.push(normalizeExcelCellValue(row.getCell(columnIndex).value));
      }

      rawRows.push(values);
    }

    while (
      rawRows.length > 0 &&
      rawRows[rawRows.length - 1].every((value) => value === "")
    ) {
      rawRows.pop();
    }

    if (!rawRows.length) {
      return;
    }

    const columnWidths = {};
    headers.forEach((header, index) => {
      const width = worksheet.getColumn(index + 1).width;
      if (Number.isFinite(width) && width > 0) {
        columnWidths[header] = Math.round(width * 8);
      }
    });

    sheets[worksheet.name] = {
      columns: headers,
      rows: rawRows.map((values, index) => {
        const rowObject = { __rowKey: index };
        headers.forEach((header, columnIndex) => {
          rowObject[header] = values[columnIndex] ?? "";
        });
        return rowObject;
      }),
      columnWidths,
    };
  });

  return {
    sheets,
    activeSheet: workbook.worksheets[0]?.name || "",
  };
};
