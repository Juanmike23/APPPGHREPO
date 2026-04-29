/*
 * PGH-DOC
 * File: src/Variables/Table/filters/compare.js
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const compare = (cellValue, operator, filterValue) => {
  if (filterValue === "") {
    return cellValue === "" || cellValue == null;
  }
  if (cellValue == null) return false;

  const cellStr = String(cellValue).toLowerCase();
  const filterStr = String(filterValue).toLowerCase();

  const numCell = Number(cellValue);
  const numFilter = Number(filterValue);
  const bothNumber = !isNaN(numCell) && !isNaN(numFilter);

  const dateCell = new Date(cellValue);
  const dateFilter = new Date(filterValue);
  const bothDate = !isNaN(dateCell) && !isNaN(dateFilter);

  switch (operator) {
    case "=":
      if (bothNumber) return numCell === numFilter;
      if (bothDate) return dateCell.getTime() === dateFilter.getTime();
      return cellStr === filterStr;
    case "!=":
      if (bothNumber) return numCell !== numFilter;
      if (bothDate) return dateCell.getTime() !== dateFilter.getTime();
      return cellStr !== filterStr;
    case ">":
      return bothNumber
        ? numCell > numFilter
        : bothDate
        ? dateCell > dateFilter
        : cellStr > filterStr;
    case "<":
      return bothNumber
        ? numCell < numFilter
        : bothDate
        ? dateCell < dateFilter
        : cellStr < filterStr;
    case ">=":
      return bothNumber
        ? numCell >= numFilter
        : bothDate
        ? dateCell >= dateFilter
        : cellStr >= filterStr;
    case "<=":
      return bothNumber
        ? numCell <= numFilter
        : bothDate
        ? dateCell <= dateFilter
        : cellStr <= filterStr;
    default:
      return cellStr.includes(filterStr);
  }
};
