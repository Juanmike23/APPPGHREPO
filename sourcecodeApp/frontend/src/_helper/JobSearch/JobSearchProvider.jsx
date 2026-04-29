/*
 * PGH-DOC
 * File: src/_helper/JobSearch/JobSearchProvider.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { JobSearchApi, KnowledgebaseApi } from "../../api";
import Context from "./index";
import React, { useEffect, useState } from "react";
import axios from "axios";

const JobSearchProvider = (props) => {
  const [jobData, setJobData] = useState([]);
  const [searchData, setSearchData] = useState([]);

  useEffect(() => {
    const getJobData = async () => {
      try {
        await axios.get(JobSearchApi).then((resp) => {
          setJobData(resp.data);
        });
        await axios.get(KnowledgebaseApi).then((resp) => {
          setSearchData(resp.data);
        });
      } catch (error) {
        console.error("cancelled", error);
      }
    };
    getJobData();
  }, [setJobData, setSearchData]);

  return (
    <Context.Provider
      value={{
        ...props,
        jobData,
        searchData,
      }}
    >
      {props.children}
    </Context.Provider>
  );
};

export default JobSearchProvider;
