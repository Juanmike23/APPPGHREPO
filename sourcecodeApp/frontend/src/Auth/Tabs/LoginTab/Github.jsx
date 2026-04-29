/*
 * PGH-DOC
 * File: src/Auth/Tabs/LoginTab/Github.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur autentikasi, login flow, dan kontrol akses user.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

/* eslint-disable no-unused-vars */
import React, { Fragment, useState, useEffect } from "react";
import { GitHub } from "react-feather";
import { Btn } from "../../../AbstractElements";
import { useNavigate } from "react-router-dom";
import man from "../../../assets/images/dashboard/1.png";

const GithubCus = () => {
  const history = useNavigate();

  const [value, setValue] = useState(localStorage.getItem("profileURL" || man));
  const [name, setName] = useState(localStorage.getItem("Name"));

  useEffect(() => {
    localStorage.setItem("profileURL", value);
    localStorage.setItem("Name", name);
  }, [value, name]);
  const githubAuth = async () => {
    history(`${process.env.PUBLIC_URL}/`);
  };
  return (
    <Fragment>
      <Btn attrBtn={{ color: "light", onClick: githubAuth }}>
        <GitHub />
      </Btn>
    </Fragment>
  );
};

export default GithubCus;
