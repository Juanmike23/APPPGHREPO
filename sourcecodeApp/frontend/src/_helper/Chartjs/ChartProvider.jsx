/*
 * PGH-DOC
 * File: src/_helper/Chartjs/ChartProvider.jsx
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
import ChartjsContext from "./index";
import axios from "axios";
import { ChartjsApi } from "../../api";

const ChartjsProvider = (props) => {
  const [chartjs, setChartjs] = useState([]);

  useEffect(() => {
    const getchartjs = async () => {
      try {
        await axios.get(ChartjsApi).then((resp) => {
          setChartjs(resp.data);
        });
      } catch (error) {
        console.error("cancelled", error);
      }
    };
    getchartjs();
  }, [setChartjs]);

  return (
    <ChartjsContext.Provider
      value={{
        ...props,
        chartjs,
      }}
    >
      {props.children}
    </ChartjsContext.Provider>
  );
};

export default ChartjsProvider;
