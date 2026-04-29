/*
 * PGH-DOC
 * File: src/Data/Chart/chartjs.js
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import configDB from "../../Config/ThemeConfig";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarController, BarElement, ArcElement, RadialLinearScale } from "chart.js";

const primary = localStorage.getItem("default_color") || configDB.color.primary_color;
const secondary = localStorage.getItem("secondary_color") || configDB.color.secondary_color;

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarController, BarElement, ArcElement, RadialLinearScale);

export const barChartData = {
  labels: ["Mon", "Tue", "Wen", "Thus", "Fri", "Sat", "Sun"],
  datasets: [
    {
      label: "y",
      lagend: "y",
      data: [35, 59, 80, 81, 56, 55, 40],
      borderColor: primary,
      backgroundColor: "rgba(36, 105, 92, 0.4)",
      highlightFill: "rgba(36, 105, 92, 0.6)",
      highlightStroke: primary,
      borderWidth: 2,
    },
    {
      label: "z",
      lagend: "z",
      data: [28, 48, 40, 19, 86, 27, 90],
      borderColor: secondary,
      backgroundColor: "rgba(186, 137, 93, 0.4)",
      highlightFill: "rgba(186, 137, 93, 0.6)",
      highlightStroke: secondary,
      borderWidth: 2,
    },
  ],
  plugins: {
    datalabels: {
      display: false,
      color: "white",
    },
  },
};
export const barChartOptions = {
  maintainAspectRatio: true,
  legend: {
    display: false,
  },
  plugins: {
    datalabels: {
      display: false,
    },
  },
};

export const lineChartData = {
  labels: ["Mon", "Tue", "Wen", "Thus", "Fri", "Sat", "Sun"],
  datasets: [
    {
      label: "My Second dataset",
      backgroundColor: "rgba(126,  55, 216, 0.3)",
      borderColor: "#7e37d8",
      pointColor: "#7e37d8",
      pointStrokeColor: "#fff",
      pointHighlightFill: "#000",
      pointHighlightStroke: "rgba(30, 166, 236, 1)",
      data: [28, 48, 40, 19, 86, 27, 90],
    },
    {
      label: "My First dataset",
      backgroundColor: "rgba(6, 181, 221, 0.5)",
      borderColor: "#06b5dd",
      pointColor: "#06b5dd",
      pointStrokeColor: "#fff",
      pointHighlightFill: "#fff",
      pointHighlightStroke: "#000",
      data: [10, 59, 80, 81, 56, 55, 40],
    },
  ],
  plugins: {
    datalabels: {
      display: false,
      color: "white",
    },
  },
};
export const lineChartOptions = {
  maintainAspectRatio: true,

  legend: {
    display: false,
  },
  plugins: {
    datalabels: {
      display: false,
    },
  },
};

export const RadarChartData = {
  labels: ["Ford", "Chevy", "Toyota", "Honda", "Mazda"],
  datasets: [
    {
      label: "My Second dataset",
      backgroundColor: "rgba(36, 105, 92, 0.4)",
      borderColor: primary,
      fill: true,
      pointBackgroundColor: "rgba(36, 105, 92, 0.4)",
      pointBorderColor: "rgba(36, 105, 92, 0.4)",
      pointHoverBackgroundColor: primary,
      pointHoverBorderColor: "rgba(36, 105, 92, 0.4)",
      data: [12, 3, 5, 18, 7],
    },
  ],
};

export const lineChart2Data = {
  labels: ["", "10", "20", "30", "40", "50", "60", "70", "80"],
  datasets: [
    {
      backgroundColor: "rgba(113, 113, 113, 0.2)",
      strokeColor: "#717171",
      pointColor: "#717171",
      data: [10, 20, 40, 30, 0, 20, 10, 30, 10],
    },
    {
      backgroundColor: "rgba(186, 137, 93, 0.2)",
      strokeColor: secondary,
      pointColor: secondary,
      data: [20, 40, 10, 20, 40, 30, 40, 10, 20],
    },
    {
      backgroundColor: "rgb(36, 105, 92, 0.2)",
      borderColor: primary,
      pointColor: primary,
      data: [60, 10, 40, 30, 80, 30, 20, 90, 0],
    },
  ],
};
export const lineChart2option = {
  maintainAspectRatio: false,
  animation: {
    duration: 0,
  },
  legend: {
    display: false,
  },
  scaleShowVerticalLines: false,
  plugins: {
    datalabels: {
      display: false,
      color: "white",
    },
  },
};

export const doughnutData = {
  labels: ["Download Sales", "In-Store Sales", "Mail-Order Sales"],
  datasets: [
    {
      data: [350, 450, 100],
      backgroundColor: [primary, secondary, "#51bb25"],
    },
  ],
};
export const doughnutOption = {
  maintainAspectRatio: false,
  legend: {
    display: false,
  },
  plugins: {
    datalabels: {
      display: false,
      color: "white",
    },
  },
};

export const polarData = {
  labels: ["Download Sales", "In-Store Sales", "Mail Sales", "Telesales", "Corporate Sales"],
  datasets: [
    {
      data: [300, 500, 100, 40, 120],
      backgroundColor: [primary, secondary, "#f8d62b", "#51bb25", "#a927f9"],
    },
  ],
};

export const polarOption = {
  legend: {
    display: false,
  },
};
