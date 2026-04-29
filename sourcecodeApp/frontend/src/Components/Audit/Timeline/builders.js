/*
 * PGH-DOC
 * File: src/Components/Audit/Timeline/builders.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */


// import {
//   fill,
//   hexToRgb,
//   colourIsLight,
//   addMonthsToYearAsDate,
//   nextColor,
//   randomTitle
// } from "./utils";
// import {
//   MAX_TRACK_START_GAP,
//   MAX_ELEMENT_GAP,
//   MAX_MONTH_SPAN,
//   MIN_MONTH_SPAN,
//   MAX_NUM_OF_SUBTRACKS,
//   START_YEAR,
//   NUM_OF_MONTHS
// } from "./constants";


// // Local helper instead of importing from react-timelines
// const buildCells = (unit, startDate, endDate) => {
//   const cells = [];
//   const cursor = new Date(startDate);

//   while (cursor < endDate) {
//     let cellStart = new Date(cursor);
//     let cellEnd;
//     let title;
//     let id;

//     if (unit === "year") {
//       cellEnd = new Date(cursor.getFullYear() + 1, 0, 1);
//       title = `${cursor.getFullYear()}`;
//       id = `y-${cursor.getFullYear()}`;
//     } else if (unit === "quarter") {
//       const quarter = Math.floor(cursor.getMonth() / 3) + 1;
//       cellEnd = new Date(cursor.getFullYear(), quarter * 3, 1);
//       title = `Q${quarter} ${cursor.getFullYear()}`;
//       id = `q-${cursor.getFullYear()}-${quarter}`;
//     } else if (unit === "month") {
//       const month = cursor.toLocaleString("default", { month: "short" });
//       cellEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
//       title = `${month} ${cursor.getFullYear()}`;
//       id = `m-${cursor.getFullYear()}-${cursor.getMonth() + 1}`;
//     }

//     cells.push({
//       id,
//       title,
//       start: cellStart,
//       end: cellEnd
//     });

//     cursor.setTime(cellEnd.getTime());
//   }

//   return cells;
// };

// /* ✅ Only one version of buildTimebar */
// export const buildTimebar = (start, end) => [
//   {
//     id: "years",
//     title: "Years",
//     cells: buildCells("year", start, end),
//     useAsGrid: true,
//     visible: true,
//   },
//   {
//     id: "quarters",
//     title: "Quarters",
//     cells: buildCells("quarter", start, end),
//     useAsGrid: true,
//     visible: true,
//   },
//   {
//     id: "months",
//     title: "Months",
//     cells: buildCells("month", start, end),
//     useAsGrid: true,
//     visible: true,
//   },
// ];

// /* Element builder */

// export const buildElement = ({ trackId, start, end, i }) => {
//   return {
//     id: `t-${trackId}-el-${i}`,
//     title: randomTitle(),
//     start,
//     end,
//     className: "audit-bar-card",   // 👈 use className instead
//   };
// };


// export const buildTrackStartGap = () =>
//   Math.floor(Math.random() * MAX_TRACK_START_GAP);

// export const buildElementGap = () =>
//   Math.floor(Math.random() * MAX_ELEMENT_GAP);

// export const buildElements = (trackId) => {
//   const v = [];
//   let i = 1;
//   let month = buildTrackStartGap();

//   while (month < NUM_OF_MONTHS) {
//     let monthSpan =
//       Math.floor(Math.random() * (MAX_MONTH_SPAN - (MIN_MONTH_SPAN - 1))) +
//       MIN_MONTH_SPAN;

//     if (month + monthSpan > NUM_OF_MONTHS) {
//       monthSpan = NUM_OF_MONTHS - month;
//     }

//     const start = addMonthsToYearAsDate(START_YEAR, month);
//     const end = addMonthsToYearAsDate(START_YEAR, month + monthSpan);
//     v.push(
//       buildElement({
//         trackId,
//         start,
//         end,
//         i
//       })
//     );
//     const gap = buildElementGap();
//     month += monthSpan + gap;
//     i += 1;
//   }

//   return v;
// };

// export const buildSubtrack = (trackId, subtrackId) => ({
//   id: `track-${trackId}-${subtrackId}`,
//   title: `Subtrack ${subtrackId}`,
//   elements: buildElements(subtrackId)
// });

// export const buildTrack = (trackId) => {
//   const tracks = fill(
//     Math.floor(Math.random() * MAX_NUM_OF_SUBTRACKS) + 1
//   ).map((i) => buildSubtrack(trackId, i + 1));

//   return {
//     id: `track-${trackId}`,
//     title: `Track ${trackId}`,
//     elements: buildElements(trackId),
//     tracks,
//     isOpen: false
//   };
// };
