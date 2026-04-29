/*
 * PGH-DOC
 * File: src/_helper/Gallery/GalleryProvider.jsx
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
import { BigImageApi, ImageLightApi, MasonryApi } from "../../api";

const GalleryProvider = (props) => {
  const [images, setImage] = useState([]);
  const [smallImages, setSmallImages] = useState([]);
  const [masonryImg, setMasonryImg] = useState([]);

  useEffect(() => {
    const getChartData = async () => {
      try {
        axios.get(ImageLightApi).then((response) => {
          setImage(response.data.src);
        });

        axios.get(BigImageApi).then((response) => {
          setSmallImages(response.data.src);
        });

        axios.get(MasonryApi).then((response) => {
          setMasonryImg(response.data);
        });
      } catch (error) {
        console.error("cancelled", error);
      }
    };
    getChartData();
  }, [setImage, setSmallImages, setMasonryImg]);

  return (
    <Context.Provider
      value={{
        ...props,
        images,
        smallImages,
        masonryImg,
      }}
    >
      {props.children}
    </Context.Provider>
  );
};

export default GalleryProvider;
