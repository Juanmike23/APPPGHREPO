/*
 * PGH-DOC
 * File: src/_helper/Contact/ContactProvider.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import Context from "./index";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { ContactApi } from "../../api";

const ContactProvider = (props) => {
  const [users, setUsers] = useState([]);
  const [data, setData] = useState([]);

  const getUsers = async () => {
    try {
      await axios.get(`${ContactApi}`).then((resp) => {
        setUsers(resp.data);
      });
    } catch (error) {
      console.error("error", error);
    }
  };

  useEffect(() => {
    getUsers();
  }, [setUsers, setData]);

  const createUser = (data, imgUrl) => {
    const userTemp = {
      id: users.length + 1,
      avatar: ("user/user.png"),
      name: data.name,
      surname: data.surname,
      email: data.email,
      age: data.age,
      mobile: data.mobile,
    };
    setUsers([...users, userTemp]);
    setData([...users, userTemp]);
  };

  const editUser = (data, imgUrl, id) => {
    const userTemp = {
      id: id,
      avatar: imgUrl,
      name: data.name,
      surname: data.surname,
      email: data.email,
      age: data.age,
      mobile: data.mobile,
    };

    setUsers((current) =>
      current.map((obj) => {
        if (obj.id === id) {
          return { ...obj, userTemp };
        }

        return obj;
      })
    );
    setData((current) =>
      current.map((obj) => {
        if (obj.id === id) {
          return { ...obj, userTemp };
        }

        return obj;
      })
    );
  };

  const deletedUser = (id) => {
  const updatedUsers = users.filter((user) => user.id!== id);
  setUsers(updatedUsers);
};

  return (
    <Context.Provider
      value={{
        ...props,
        users,
        data,
        setUsers: setUsers,
        createUser: createUser,
        editUser: editUser,
        deletedUser: deletedUser,
      }}
    >
      {props.children}
    </Context.Provider>
  );
};

export default ContactProvider;
