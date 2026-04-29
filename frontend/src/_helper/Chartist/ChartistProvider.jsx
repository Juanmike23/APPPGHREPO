/*
 * PGH-DOC
 * File: src/_helper/Chartist/ChartistProvider.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useState } from "react";
import Context from "./index";
import axios from "axios";
import { ChartistApi } from "../../api";

const ChartistProvider = (props) => {
  const [chartistData, setChartistData] = useState([]);

  useEffect(() => {
    const getChartData = async () => {
      try {
        await axios.get(ChartistApi).then((resp) => {
          setChartistData(resp.data);
        });
      } catch (error) {
        console.error("cancelled", error);
      }
    };
    getChartData();
  }, [setChartistData]);

  return (
    <Context.Provider
      value={{
        ...props,
        chartistData,
      }}
    >
      {props.children}
    </Context.Provider>
  );
};

export default ChartistProvider;
