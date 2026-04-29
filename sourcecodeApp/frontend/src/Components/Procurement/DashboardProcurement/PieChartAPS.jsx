/*
 * PGH-DOC
 * File: src/Components/Procurement/DashboardProcurement/PieChartAPS.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// import React, { useEffect, useState } from "react";
// import {
//   CardTitle,
//   Card,
//   CardBody,
//   Spinner,
//   ButtonGroup,
//   Button,
//   Col,
// } from "@pgh/ui-bootstrap";
// import Chart from "react-apexcharts";

// const ProcureOverviewChart = () => {
//   const [loading, setLoading] = useState(true);
//   const [series, setSeries] = useState([]);
//   const [labels, setLabels] = useState([]);
//   const [total, setTotal] = useState(0);

//   const [endpoint, setEndpoint] = useState("overview");
//   const [months, setMonths] = useState(6);

//   const [totals, setTotals] = useState({
//     overview: null,
//     6: null,
//     3: null,
//     1: null,
//   });

//   const API_BASE = `${process.env.REACT_APP_API_BASE_URL}apschart/chart`;

//   const chartOptions = {
//     chart: { type: "pie", height: 350 },
//     labels,
//     legend: {
//       position: "right",
//       horizontalAlign: "center",
//       fontSize: "13px",
//       width: 200, // 👈 fixed legend box width
//       itemMargin: { vertical: 4 },
//       formatter: (seriesName, opts) => {
//         const value = opts.w.globals.series[opts.seriesIndex];
//         // no truncation; let CSS wrap it
//         return `<span class="legend-text">${seriesName}: ${value}</span>`;
//       },
//     },

//     dataLabels: {
//       enabled: true,
//       formatter: (val) => `${val.toFixed(1)}%`,
//     },
//     tooltip: {
//       y: { formatter: (value) => `${value} items` },
//     },
//   };

//   // 🔹 Fetch chart data for the selected tab
//   const fetchChartData = async () => {
//     setLoading(true);
//     try {
//       let url = `${API_BASE}/${endpoint}`;
//       if (endpoint === "duedue") url += `?months=${months}`;

//       const response = await fetch(url, { credentials: "include" });
//       if (!response.ok) throw new Error(`Fetch error: ${response.status}`);
//       const data = await response.json();

//       const values = data.Values || [];
//       const labels = data.Labels || [];
//       const totalCount = values.reduce((sum, val) => sum + val, 0);

//       setSeries(values);
//       setLabels(labels);
//       setTotal(totalCount);
//     } catch (err) {
//       console.error("❌ Chart fetch failed:", err);
//       setSeries([]);
//       setLabels([]);
//       setTotal(0);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // 🔹 Fetch totals for all buttons (overview, 6, 3, 1)
//   const fetchAllTotals = async () => {
//     try {
//       const urls = {
//         overview: `${API_BASE}/overview`,
//         6: `${API_BASE}/duedue?months=6`,
//         3: `${API_BASE}/duedue?months=3`,
//         1: `${API_BASE}/duedue?months=1`,
//       };

//       const responses = await Promise.all(
//         Object.entries(urls).map(([key, url]) =>
//           fetch(url, { credentials: "include" })
//             .then((r) => (r.ok ? r.json() : null))
//             .catch(() => null)
//         )
//       );

//       const newTotals = {};
//       [1, 3, 6, "overview"].forEach((key, i) => {
//         const data = responses[i];
//         if (data && Array.isArray(data.Values)) {
//           newTotals[key] = data.Values.reduce((sum, val) => sum + val, 0);
//         } else {
//           newTotals[key] = null;
//         }
//       });

//       setTotals(newTotals);
//     } catch (err) {
//       console.error("❌ Failed to fetch totals:", err);
//     }
//   };

//   useEffect(() => {
//     fetchChartData();
//   }, [endpoint, months]);

//   useEffect(() => {
//     fetchAllTotals();
//   }, []);

//   return (
//     <Col sm="12" xl="6">
//       <Card className="shadow-sm mt-3">
//         <CardBody>
//           <h3 className="mb-3">Reminder Chart</h3>
//           {/* <div className="d-flex justify-content-between align-items-center mb-3"> */}
//         <div className="d-flex justify-content-center align-items-center mb-3">

//             {/* <CardTitle tag="h5" className="mb-0">
//             Now
//           </CardTitle> */}

//             <ButtonGroup>
//               <Button
//                 color={endpoint === "overview" ? "primary" : "outline-info"}
//                 onClick={() => setEndpoint("overview")}
//                 className="d-flex flex-column align-items-center justify-content-center p-0"
//                 style={{
//                   lineHeight: 1.2,
//                   minWidth: "90px",
//                   paddingLeft: 0, // just to be sure
//                   paddingRight: 0, // just to be sure
//                 }}
//               >
//                 <span
//                   style={{
//                     fontSize: "0.75rem",
//                     opacity: 0.8,
//                     marginTop: "6px", // 👈 adds space above

//                     padding: 0,
//                   }}
//                 >
//                   Total
//                 </span>
//                 <span
//                   style={{
//                     fontSize: "1.1rem",
//                     fontWeight: "600",
//                     color: endpoint === "overview" ? "inherit" : "#aa9d9dff",

//                     marginBottom: "6px", // no space below  // 👈 ensure no left/right offset
//                     padding: 0,
//                   }}
//                 >
//                   ({totals.overview ?? "..."})
//                 </span>
//               </Button>

//               <Button
//                 color={
//                   endpoint === "duedue" && months === 6
//                     ? "primary"
//                     : "outline-info"
//                 }
//                 onClick={() => {
//                   setEndpoint("duedue");
//                   setMonths(6);
//                 }}
//                 className="d-flex flex-column align-items-center justify-content-center p-0"
//                 style={{
//                   lineHeight: 1.2,
//                   minWidth: "90px",
//                   paddingLeft: 0,
//                   paddingRight: 0,
//                 }}
//               >
//                 <span
//                   style={{
//                     fontSize: "0.75rem",
//                     opacity: 0.8,
//                     marginTop: "6px", // 👈 adds space above

//                     padding: 0,
//                   }}
//                 >
//                   &lt; 6 months
//                 </span>
//                 <span
//                   style={{
//                     fontSize: "1.1rem",
//                     fontWeight: "600",
//                     color:
//                       endpoint === "duedue" && months === 6
//                         ? "inherit"
//                         : "#aa9d9dff",

//                     marginBottom: "4px", // no space below
//                     padding: 0,
//                   }}
//                 >
//                   ({totals[6] ?? "..."})
//                 </span>
//               </Button>

//               <Button
//                 color={
//                   endpoint === "duedue" && months === 3
//                     ? "primary"
//                     : "outline-info"
//                 }
//                 onClick={() => {
//                   setEndpoint("duedue");
//                   setMonths(3);
//                 }}
//                 className="d-flex flex-column align-items-center justify-content-center p-0"
//                 style={{
//                   lineHeight: 1.2,
//                   minWidth: "90px",
//                   paddingLeft: 0,
//                   paddingRight: 0,
//                 }}
//               >
//                 <span
//                   style={{
//                     fontSize: "0.75rem",
//                     opacity: 0.8,
//                     marginTop: "6px", // 👈 adds space above

//                     padding: 0,
//                   }}
//                 >
//                   &lt; 3 months
//                 </span>
//                 <span
//                   style={{
//                     fontSize: "1.1rem",
//                     fontWeight: "600",
//                     color:
//                       endpoint === "duedue" && months === 3
//                         ? "inherit"
//                         : "#aa9d9dff",

//                     marginBottom: "4px", // no space below
//                     padding: 0,
//                   }}
//                 >
//                   ({totals[3] ?? "..."})
//                 </span>
//               </Button>

//               <Button
//                 color={
//                   endpoint === "duedue" && months === 1
//                     ? "primary"
//                     : "outline-info"
//                 }
//                 onClick={() => {
//                   setEndpoint("duedue");
//                   setMonths(1);
//                 }}
//                 className="d-flex flex-column align-items-center justify-content-center p-0"
//                 style={{
//                   lineHeight: 1.2,
//                   minWidth: "90px",
//                   paddingLeft: 0,
//                   paddingRight: 0,
//                 }}
//               >
//                 <span
//                   style={{
//                     fontSize: "0.75rem",
//                     opacity: 0.8,
//                     marginTop: "6px", // 👈 adds space above

//                     padding: 0,
//                   }}
//                 >
//                   &lt; 1 months
//                 </span>
//                 <span
//                   style={{
//                     fontSize: "1.1rem",
//                     fontWeight: "600",
//                     color:
//                       endpoint === "duedue" && months === 1
//                         ? "inherit"
//                         : "#aa9d9dff",

//                     marginBottom: "4px", // no space below
//                     padding: 0,
//                   }}
//                 >
//                   ({totals[1] ?? "..."})
//                 </span>
//               </Button>
//             </ButtonGroup>
//           </div>
//           {loading ? (
//             <div className="text-center">
//               <Spinner color="primary" />
//             </div>
//           ) : series.length > 0 ? (
//             <div className="d-flex justify-content-center">
//               <Chart
//                 options={chartOptions}
//                 series={series}
//                 type="pie"
//                 width={450}
//               />
//             </div>
//           ) : (
//             <p className="text-center text-muted">No chart data available.</p>
//           )}
//         </CardBody>
//       </Card>
//     </Col>
//   );
// };

// export default ProcureOverviewChart;
