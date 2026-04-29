/*
 * PGH-DOC
 * File: src/_helper/Faq/FaqProvider.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import axios from "axios";
import React, { useEffect, useState } from "react";
import { FaqApi } from "../../api";
import Context from "./index";

const EmailProvider = (props) => {
  const [faq, setFaq] = useState([]);

  const fetchFaq = async () => {
    try {
      await axios.get(`${FaqApi}`).then((resp) => {
        setFaq(resp.data);
      });
    } catch (error) {
      console.error("error", error);
    }
  };

  useEffect(() => {
    fetchFaq();
  }, [setFaq]);

  return (
    <Context.Provider
      value={{
        ...props,
        faq,
      }}
    >
      {props.children}
    </Context.Provider>
  );
};

export default EmailProvider;
