/*
 * PGH-DOC
 * File: src/_helper/Project/ProjectProvider.jsx
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
import { AllProjectApi } from "../../api";

const ProjectProvider = (props) => {
  const [allData, setAllData] = useState([]);
  const [project, setProject] = useState([]);

  const getAllProjectData = async () => {
    try {
      await axios.get(AllProjectApi).then((resp) => {
        setAllData(resp.data);
      });
    } catch (error) {
      console.error("cancelled", error);
    }
  };

  useEffect(() => {
    getAllProjectData();
  }, [setAllData, setProject]);

  const addNewProject = (projectData) => {
    const projectTemp = {
      id: allData.length + 1,
      title: projectData.title,
      badge: projectData.badge,
      img: "user/3.jpg",
      sites: "Themeforest, australia",
      desc: projectData.desc,
      issue: projectData.issues,
      resolved: projectData.resolved,
      comment: projectData.comment,
      like: "10",
      progress: "70",
      customers_img1: "user/3.jpg",
      customers_img2: "user/5.jpg",
      customers_img3: "user/1.jpg",
    };
    setAllData([...allData, projectTemp]);
  };

  return (
    <Context.Provider
      value={{
        ...props,
        addNewProject: addNewProject,
        project,
        allData,
      }}
    >
      {props.children}
    </Context.Provider>
  );
};

export default ProjectProvider;
