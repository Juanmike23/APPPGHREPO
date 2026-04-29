/*
 * PGH-DOC
 * File: src/_helper/Chat/ChatProvider.jsx
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
import { ChatApi, ChatMemberApi } from "../../api";

const ChatProvider = (props) => {
  const [allMemberss, setAllMembers] = useState([]);
  const [memberss, setMembers] = useState();
  const [chatss, setChats] = useState([]);
  const [currentUserr, setCurrentUser] = useState();
  const [selectedUserr, setSelectedUser] = useState();
  const getChatMembersData = async () => {
    try {
      await axios.get(ChatMemberApi).then((resp) => {
        setAllMembers(resp.data);
      });
    } catch (error) {
      console.error("error", error);
    }
  };
  useEffect(() => {
    getChatMembersData();
  }, [setAllMembers, setMembers, setSelectedUser, setCurrentUser, setChats]);

  const getMembersSuccess = (chats) => {
    setCurrentUser(chats[0]);
    setMembers(chats);
  };

  const fetchChatMemberAsyn = () => {
    if (allMemberss.length > 0) getMembersSuccess(allMemberss);
  };

  useEffect(() => {
    const getChatData = async () => {
      try {
        await axios.get(ChatApi).then((resp) => {
          setChats(resp.data);
        });
      } catch (error) {
        console.error("error", error);
      }
    };
    getChatData();
  }, [setChats]);

  const getChatsSuccess = (chats, selectedUser, online) => {
    if (allMemberss.length > 0) {
      setChats(chats);
      setSelectedUser(allMemberss.find((x) => x.id === selectedUser));
    }
  };

  const updateSelectedUser = (selectedUser, online) => {
    if (allMemberss.length > 0) return allMemberss.find((x) => x.id === selectedUser);
  };

  const fetchChatAsyn = () => {
    if (chatss?.data?.length > 0) {
      const currentUserId = 0;
      const online = true;

      const chat = chatss.data.filter((x) => x.users.includes(currentUserId));
      const selectedUser = chatss.data[0].users.find((x) => x !== currentUserId);

      getChatsSuccess(chat, selectedUser, online);
      updateSelectedUser(selectedUser, online);
    }
  };

  const sendMessageToChat = async (currentUserId, chats) => {
    try {
      await axios.put(`${ChatApi}/${chats.data[currentUserId].id}`, chats.data[currentUserId]);
    } catch (error) {
      console.error("error", error);
    }
  };

  const sendMessageAsyn = (currentUserId, selectedUserId, messageInput, chats, online) => {
    let chat = chats.find((x) => x.users.includes(currentUserId) && x.users.includes(selectedUserId));
    const now = new Date();
    const time = now.getHours() + ":" + now.getMinutes();
    const status = online;
    if (chat) {
      chat.messages.push({
        sender: currentUserId,
        time: time,
        text: messageInput,
        status: true,
      });
      chat.lastMessageTime = time;
      chat.online = status;

      let chats_data = chats.filter((x) => x.id !== chat.id);
      chats_data.splice(0, 0, chat);
      getChatsSuccess(chats, selectedUserId, online);
    }
    setTimeout(() => {
      sendMessageToChat(currentUserId, chats);
    }, 1000);
  };

  const replyByUserAsyn = (currentUserId, selectedUserId, replyMessage, chats, online) => {
    let chat = chats.find((x) => x.users.includes(currentUserId) && x.users.includes(selectedUserId));
    const now = new Date();
    const time = now.getHours() + ":" + now.getMinutes();
    const status = online;
    if (chat) {
      chat.messages.push({
        sender: selectedUserId,
        time: time,
        text: replyMessage,
        status: true,
      });
      chat.lastMessageTime = time;
      chat.online = status;
      let chats_data = chats.filter((x) => x.id !== chat.id);
      chats_data.splice(0, 0, chat);

      getChatsSuccess(chats_data, selectedUserId, online);
    }

    sendMessageToChat(currentUserId, chats);
  };

  const createNewChatAsyn = (currentUserId, selectedUserId, chats) => {
    let conversation = {
      id: chats.length + 1,
      users: [currentUserId, selectedUserId],
      lastMessageTime: "-",
      messages: [],
    };
    chats.splice(0, 0, conversation);
    getChatsSuccess(chats, selectedUserId);
  };

  const changeChat = (userID) => {
    setSelectedUser(allMemberss.find((x) => x.id === userID));
  };

  const searchMember = (keywords) => {
    if (keywords === "") {
      setMembers(allMemberss);
    } else {
      const keyword = keywords.toLowerCase();
      const searchedMembers = allMemberss.filter((member) => member.name.toLowerCase().indexOf(keyword) > -1);
      setMembers(searchedMembers);
    }
  };

  return (
    <Context.Provider
      value={{
        ...props,
        allMemberss,
        chatss,
        selectedUserr,
        currentUserr,
        memberss,
        getChatsSuccess: getChatsSuccess,
        updateSelectedUserr: updateSelectedUser,
        fetchChatAsyn: fetchChatAsyn,
        fetchChatMemberAsyn: fetchChatMemberAsyn,
        sendMessageAsyn: sendMessageAsyn,
        replyByUserAsyn: replyByUserAsyn,
        createNewChatAsyn: createNewChatAsyn,
        changeChat: changeChat,
        searchMember: searchMember,
      }}
    >
      {props.children}
    </Context.Provider>
  );
};

export default ChatProvider;
