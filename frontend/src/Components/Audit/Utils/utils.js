/*
 * PGH-DOC
 * File: src/Components/Audit/Utils/utils.js
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// /* eslint-disable no-bitwise */

// // import { MONTHS_PER_YEAR } from "../Timeline/constants";

// export const fill = (n) => {
//   const arr = [];
//   for (let i = 0; i < n; i += 1) {
//     arr.push(i);
//   }
//   return arr;
// };

// const COLORS = [
//   "FF005D",
//   "0085B6",
//   "0BB4C1",
//   "00D49D",
//   "FEDF03",
//   "233D4D",
//   "FE7F2D",
//   "FCCA46",
//   "A1C181",
//   "579C87"
// ];

// export const randomColor = () =>
//   COLORS[Math.floor(Math.random() * COLORS.length)];

// let color = -1;
// export const nextColor = () => {
//   color = (color + 1) % COLORS.length;
//   return COLORS[color];
// };

// // let prevColor = null
// // export const nextRandomColor = () => {
// //   let c = randomColor()
// //   while (c === prevColor) {
// //     c = randomColor()
// //   }
// //   prevColor = c
// //   return c
// // }

// // export const randomColor = () => {
// //   const LETTERS = '0123456789ABCDEF'
// //   let color = ''
// //   for (let i = 0; i < 6; i += 1) {
// //     color += LETTERS[Math.floor(Math.random() * 16)]
// //   }
// //   return color
// // }

// export const hexToRgb = (hex) => {
//   const v = parseInt(hex, 16);
//   const r = (v >> 16) & 255;
//   const g = (v >> 8) & 255;
//   const b = v & 255;
//   return [r, g, b];
// };

// export const colourIsLight = (r, g, b) => {
//   const a = 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255;
//   return a < 0.5;
// };

// // export const addMonthsToYear = (year, monthsToAdd) => {
// //   let y = year;
// //   let m = monthsToAdd;
// //   while (m >= MONTHS_PER_YEAR) {
// //     m -= MONTHS_PER_YEAR;
// //     y += 1;
// //   }
// //   return { year: y, month: m + 1 };
// // };

// // export const addMonthsToYearAsDate = (year, monthsToAdd) => {
// //   const r = addMonthsToYear(year, monthsToAdd);
// //   return new Date(`${r.year}-${r.month}`);
// // };

// // Credit: https://jsfiddle.net/katowulf/3gtDf/
// const ADJECTIVES = [
//   "adamant",
//   "adroit",
//   "amatory",
//   "animistic",
//   "antic",
//   "arcadian",
//   "baleful",
//   "bellicose",
//   "bilious",
//   "boorish",
//   "calamitous",
//   "caustic",
//   "cerulean",
//   "comely",
//   "concomitant",
//   "contumacious",
//   "corpulent",
//   "crapulous",
//   "defamatory",
//   "didactic",
//   "dilatory",
//   "dowdy",
//   "efficacious",
//   "effulgent",
//   "egregious",
//   "endemic",
//   "equanimous",
//   "execrable",
//   "fastidious",
//   "feckless",
//   "fecund",
//   "friable",
//   "fulsome",
//   "garrulous",
//   "guileless",
//   "gustatory",
//   "heuristic",
//   "histrionic",
//   "hubristic",
//   "incendiary",
//   "insidious",
//   "insolent",
//   "intransigent",
//   "inveterate",
//   "invidious",
//   "irksome",
//   "jejune",
//   "jocular",
//   "judicious",
//   "lachrymose",
//   "limpid",
//   "loquacious",
//   "luminous",
//   "mannered",
//   "mendacious",
//   "meretricious",
//   "minatory",
//   "mordant",
//   "munificent",
//   "nefarious",
//   "noxious",
//   "obtuse",
//   "parsimonious",
//   "pendulous",
//   "pernicious",
//   "pervasive",
//   "petulant",
//   "platitudinous",
//   "precipitate",
//   "propitious",
//   "puckish",
//   "querulous",
//   "quiescent",
//   "rebarbative",
//   "recalcitant",
//   "redolent",
//   "rhadamanthine",
//   "risible",
//   "ruminative",
//   "sagacious",
//   "salubrious",
//   "sartorial",
//   "sclerotic",
//   "serpentine",
//   "spasmodic",
//   "strident",
//   "taciturn",
//   "tenacious",
//   "tremulous",
//   "trenchant",
//   "turbulent",
//   "turgid",
//   "ubiquitous",
//   "uxorious",
//   "verdant",
//   "voluble",
//   "voracious",
//   "wheedling",
//   "withering",
//   "zealous"
// ];
// const NOUNS = [
//   "ninja",
//   "chair",
//   "pancake",
//   "statue",
//   "unicorn",
//   "rainbows",
//   "laser",
//   "senor",
//   "bunny",
//   "captain",
//   "nibblets",
//   "cupcake",
//   "carrot",
//   "gnomes",
//   "glitter",
//   "potato",
//   "salad",
//   "toejam",
//   "curtains",
//   "beets",
//   "toilet",
//   "exorcism",
//   "stick figures",
//   "mermaid eggs",
//   "sea barnacles",
//   "dragons",
//   "jellybeans",
//   "snakes",
//   "dolls",
//   "bushes",
//   "cookies",
//   "apples",
//   "ice cream",
//   "ukulele",
//   "kazoo",
//   "banjo",
//   "opera singer",
//   "circus",
//   "trampoline",
//   "carousel",
//   "carnival",
//   "locomotive",
//   "hot air balloon",
//   "praying mantis",
//   "animator",
//   "artisan",
//   "artist",
//   "colorist",
//   "inker",
//   "coppersmith",
//   "director",
//   "designer",
//   "flatter",
//   "stylist",
//   "leadman",
//   "limner",
//   "make-up artist",
//   "model",
//   "musician",
//   "penciller",
//   "producer",
//   "scenographer",
//   "set decorator",
//   "silversmith",
//   "teacher",
//   "auto mechanic",
//   "beader",
//   "bobbin boy",
//   "clerk of the chapel",
//   "filling station attendant",
//   "foreman",
//   "maintenance engineering",
//   "mechanic",
//   "miller",
//   "moldmaker",
//   "panel beater",
//   "patternmaker",
//   "plant operator",
//   "plumber",
//   "sawfiler",
//   "shop foreman",
//   "soaper",
//   "stationary engineer",
//   "wheelwright",
//   "woodworkers"
// ];

// export const randomTitle = () =>
//   `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]} ${
//     NOUNS[Math.floor(Math.random() * NOUNS.length)]
//   }`;


//   // utils.js
// export const monthMap = {
//   Jan: 0, January: 0,
//   Feb: 1, February: 1,
//   Mar: 2, March: 2,
//   Apr: 3, April: 3,
//   May: 4,
//   Jun: 5, June: 5,
//   Jul: 6, July: 6,
//   Aug: 7, August: 7,
//   Sep: 8, Sept: 8, September: 8,
//   Oct: 9, October: 9,
//   Nov: 10, November: 10,
//   Dec: 11, December: 11,
// };

// export const parseDate = (str, fallback = new Date()) => {
//   if (!str) return fallback;
//   const s = str.trim();

//   // dd/mm/yyyy
//   if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
//     const [d, m, y] = s.split("/");
//     return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
//   }

//   // dd-mm-yyyy
//   if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
//     const [d, m, y] = s.split("-");
//     return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
//   }

//   // Mon.yyyy (Jan.2024 / Des.2024)
//   if (/^[A-Za-z]{3}\.\d{4}$/.test(s)) {
//     const [mon, year] = s.split(".");
//     const monthIndex = monthMap[mon] ?? -1;
//     if (monthIndex >= 0) return new Date(parseInt(year), monthIndex, 1);
//   }

//   // dd Mon yyyy (1 Jan 2024 / 1 Des 2024)
//   if (/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$/.test(s)) {
//     return new Date(s);
//   }

//   // dd.Mon.yyyy (1.Jan.2024 / 1.Des.2024)
//   if (/^\d{1,2}\.[A-Za-z]{3}\.\d{4}$/.test(s)) {
//     const [d, mon, y] = s.split(".");
//     const monthIndex = monthMap[mon] ?? -1;
//     if (monthIndex >= 0) return new Date(parseInt(y), monthIndex, parseInt(d));
//   }

//   // dd Mon.yyyy (1 Jan.2024 / 1 Des.2024)
//   if (/^\d{1,2}\s+[A-Za-z]{3}\.\d{4}$/.test(s)) {
//     const [dayPart, yearPart] = s.split(/\s+/);
//     const d = parseInt(dayPart);
//     const [mon, y] = yearPart.split(".");
//     const monthIndex = monthMap[mon] ?? -1;
//     if (monthIndex >= 0) return new Date(parseInt(y), monthIndex, d);
//   }

//   // fallback
//   const t = new Date(s);
//   return isNaN(t.getTime()) ? fallback : t;
// };

// // map to tracks
// export const mapRowsToTracks = (rows) => {
//   return rows.map((row, idx) => {
//     const start = parseDate(row.IN);                // ⬅️ IN as start
//     const end = parseDate(row.JATUHTEMPO);          // ⬅️ JATUHTEMPO as end

//     // ✅ Debug log supaya kelihatan jelas
//     console.log("Row:", {
//       NAMAAUDIT: row.NAMAAUDIT,
//       IN: row.IN,
//       JATUHTEMPO: row.JATUHTEMPO,
//       ParsedStart: start,
//       ParsedEnd: end,
//     });

//     return {
//       id: `track-${idx}`,
//       title: row.NAMAAUDIT ?? `Audit ${idx + 1}`,
//       elements: [
//   {
//     id: `el-${row.Id ?? idx}`,
//     start,
//     end,
//     className: "audit-bar-card",   // add your CSS class
//     title: `${row.NAMAAUDIT}\nIn: ${row.IN}\nDue: ${row.JATUHTEMPO}`,
//   },
// ],


//     };
//   });
// };
