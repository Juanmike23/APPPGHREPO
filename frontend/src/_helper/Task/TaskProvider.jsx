/*
 * PGH-DOC
 * File: src/_helper/Task/TaskProvider.jsx
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
import { TaskApi } from "../../api";

const TaskProvider = (props) => {
  const [allTask, setAllTask] = useState([]);
  const [newTask, setNewTask] = useState([]);

  const getTask = async () => {
    try {
      await axios.get(TaskApi).then((resp) => {
        setAllTask(resp.data);
      });
    } catch (error) {
      console.error("error", error);
    }
  };

  useEffect(() => {
    getTask();
  }, [setAllTask, setNewTask]);

  const AddNewTask = (data) => {
    const taskTemp = {
      id: allTask.length + 1,
      title: data.title,
      collection: data.collection,
      desc: data.desc,
    };
    setAllTask([...allTask, taskTemp]);
  };

  const RemoveTask = (id) => {
    setAllTask(allTask.filter((data) => data.id !== id));
  };

  return (
    <Context.Provider
      value={{
        ...props,
        allTask,
        newTask,
        AddNewTask: AddNewTask,
        RemoveTask: RemoveTask,
      }}
    >
      {props.children}
    </Context.Provider>
  );
};

export default TaskProvider;
