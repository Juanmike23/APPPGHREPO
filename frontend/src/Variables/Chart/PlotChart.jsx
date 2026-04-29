/*
 * PGH-DOC
 * File: src/Variables/Chart/PlotChart.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// import React, { Fragment, useMemo } from "react";
// import { useNavigate } from "react-router-dom";
// import ReactApexChart from "react-apexcharts";

// const PlotChartClass = ({
//   title = "",
//   chartcolumn,
//   chartData = [["Label", "Count"]],
//   type = "bar", // can be "bar" | "column" | "line"
// }) => {
//   const navigate = useNavigate();

//   const handleClick = (label) => {
//     navigate(
//       `/PGH/audit/summary?chartcolumn=${chartcolumn}&label=${encodeURIComponent(
//         label
//       )}`,
//       { state: { label, chartcolumn } }
//     );
//   };

//   const hasData = chartData.length > 1;
//   const labels = chartData.slice(1).map(([label]) => label);
//   const seriesValues = chartData.slice(1).map(([_, value]) => value);

//   // 🎨 Consistent colors
//   const colors = [
//     "#3f435d",
//     "#eaca80",
//     "#ffaf59",
//     "#F15A22",
//     "#d5392e",
//     "#9d2393",
//   ];

//   const options = useMemo(
//     () => ({
//       chart: {
//         type,
//         toolbar: { show: false },
//         animations: { enabled: true },
//         events: {
//           dataPointSelection: (event, chartContext, config) => {
//             const label = labels[config.dataPointIndex];
//             if (label) handleClick(label);
//           },
//         },
//       },
//       colors,
//       plotOptions: {
//         bar: {
//           horizontal: type === "bar",
//           columnWidth: "45%",
//           borderRadius: 4,
//           distributed: true,
//           dataLabels: {
//             position: "top",
//           },
//         },
//       },
//       dataLabels: {
//         enabled: true,
//         formatter: (val) => val,
//         offsetY: -10,
//         style: {
//           fontSize: "10px",
//         },
//       },
//       xaxis: {
//         categories: labels,
//         labels: {
//           style: {
//             fontSize: "10px",
//           },
//         },
//       },
//       yaxis: {
//         labels: {
//           style: {
//             fontSize: "10px",
//           },
//         },
//       },
//       tooltip: {
//         y: {
//           formatter: (val, opts) =>
//             `${labels[opts.dataPointIndex]}: ${val}`,
//         },
//       },
//       legend: { show: false },
//       grid: {
//         strokeDashArray: 3,
//         borderColor: "#e0e0e0",
//       },
//     }),
//     [labels, colors, type]
//   );

//   const series = [
//     {
//       name: "Count",
//       data: seriesValues,
//     },
//   ];

//   return (
//     <Fragment>
//       <div
//         style={{
//           display: "flex",
//           flexDirection: "column",
//           alignItems: "start",
//           width: "100%",
//         }}
//       >
//         {/* Title */}
//         <h5 className="m-0 f-w-400 text-center" style={{ fontSize: "16px" }}>
//           {title}
//         </h5>
//         <div
//           style={{
//             width: "260px",
//             height: "1px",
//             backgroundColor: "#c3c4c8",
//             margin: "6px auto 10px",
//             borderRadius: "2px",
//             marginBottom: "16px",
//           }}
//         />

//         {hasData ? (
//           <ReactApexChart
//             options={options}
//             series={series}
//             type={type === "bar" ? "bar" : "line"} // bar/line both supported
//             height={250}
//           />
//         ) : (
//           <div style={{ fontSize: "10px", marginTop: "8px" }}>No data</div>
//         )}
//       </div>
//     </Fragment>
//   );
// };

// export default PlotChartClass;
