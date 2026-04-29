/*
 * PGH-DOC
 * File: src/_helper/GoogleChart/GoogleChartProvider.jsx
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
import { GooglechartApi } from "../../api";
import Context from "./index";
import axios from "axios";

const GoogleChartProvider = (props) => {
  const [googleChart, setGoogleChart] = useState([]);

  useEffect(() => {
    const getChartData = async () => {
      try {
        await axios.get(GooglechartApi).then((resp) => {
          setGoogleChart(resp.data);
        });
      } catch (error) {
        console.error("cancelled", error);
      }
    };
    getChartData();
  }, [setGoogleChart]);

  return (
    <Context.Provider
      value={{
        ...props,
        googleChart,
      }}
    >
      {props.children}
    </Context.Provider>
  );
};

export default GoogleChartProvider;
