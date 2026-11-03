import React, { useState, useEffect, useRef, useCallback } from "react";

import { useSelector } from "react-redux";
import axios from "axios";
import io from "socket.io-client";
import { ServerUrl } from "../App";
import Lefthome from "./Lefthome";


const Icon = ({ name, size = 20, className = "" }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  const icons = {
    message: (
      <>
        <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    back: <path d="m15 18-6-6 6-6M9 12h12" />,
    close: <path d="m18 6-12 12M6 6l12 12" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </>
    ),
    send: <path d="m22 2-7 20-4-9-9-4Z M22 2 11 13" />,
    online: <circle cx="12" cy="12" r="5" fill="currentColor" />,
    offline: <circle cx="12" cy="12" r="5" />,
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        <path d="M10 11v5M14 11v5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  };

  return <svg {...common}>{icons[name]}</svg>;
};

export default function Message() {
  const { userdata } = useSelector((state) => state.user || {});

  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [previousChats, setPreviousChats] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const selectedUserRef = useRef(null);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

 
  useEffect(() => {
    if (!image) {
      setImagePreview("");
      return;
    }

    const url = URL.createObjectURL(image);
    setImagePreview(url);

    return () => URL.revokeObjectURL(url);
  }, [image]);

 
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping, scrollToBottom]);


  const getDisplayName = (user) =>
    user?.username || user?.name || "Unknown User";

  const getProfilePic = (user) => user?.profileimg || user?.profilepic || "";

  const getImageUrl = (path) => {
    if (!path || path === "uploading...") return "";
    if (path.startsWith("http")) return path;
    return `${ServerUrl}${path}`;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";

    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getUserInitials = (user) =>
    getDisplayName(user)
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "??";

  const getAvatarColor = (userId) => {
    const colors = [
      "bg-blue-600",
      "bg-green-600",
      "bg-purple-600",
      "bg-pink-600",
      "bg-red-600",
      "bg-indigo-600",
      "bg-teal-600",
    ];

    if (!userId) return colors[0];
    return colors[userId.charCodeAt(0) % colors.length];
  };

  const isUserOnline = (userId) => onlineUsers.has(userId);

  
  const updatePreviousChatsWithMessage = useCallback(
    (message) => {
      setPreviousChats((prev) => {
        const otherUserId =
          message.sender?._id === userdata?._id
            ? message.receiver?._id
            : message.sender?._id;

        const index = prev.findIndex((chat) => chat._id === otherUserId);

        if (index === -1) return prev;

        const updated = [...prev];

        const updatedUser = {
          ...updated[index],
          lastMessage: message,
          updatedAt: new Date().toISOString(),
        };

        updated.splice(index, 1);
        updated.unshift(updatedUser);

        return updated;
      });
    },
    [userdata?._id],
  );

 
  useEffect(() => {
    if (!userdata?._id) return;

    const socket = io(ServerUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("user_online", userdata._id);

      const conversationId = selectedUserRef.current?.conversationId;

      if (conversationId) {
        socket.emit("join_conversation", conversationId);
      }
    });

    socket.on("receive_message", (message) => {
      const currentUser = selectedUserRef.current;

      
      if (message.sender?._id === userdata._id) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (
              msg.isOptimistic &&
              msg.message === message.message &&
              Math.abs(
                new Date(msg.createdAt).getTime() -
                  new Date(message.createdAt).getTime(),
              ) < 5000
            ) {
              return message;
            }

            return msg;
          }),
        );

        updatePreviousChatsWithMessage(message);
        return;
      }

      
      if (
        currentUser &&
        (message.sender?._id === currentUser._id ||
          message.receiver?._id === currentUser._id)
      ) {
        setMessages((prev) => {
          const exists = prev.some(
            (msg) =>
              msg._id === message._id ||
              (msg.tempId && msg.tempId === message.tempId),
          );

          if (exists) return prev;

          return [...prev, message];
        });

        updatePreviousChatsWithMessage(message);
      }
    });

    socket.on("user_typing", (data) => {
      if (
        data.userId !== userdata._id &&
        data.conversationId === selectedUserRef.current?.conversationId
      ) {
        setIsTyping(data.isTyping);
      }
    });

    socket.on("user_status_changed", (data) => {
      setOnlineUsers((prev) => {
        const updated = new Set(prev);

        if (data.isOnline) {
          updated.add(data.userId);
        } else {
          updated.delete(data.userId);
        }

        return updated;
      });
    });

    return () => {
      clearTimeout(typingTimeoutRef.current);
      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [userdata?._id, updatePreviousChatsWithMessage]);

  
  const selectChat = (user) => {
    setSelectedUser(user);
    setMobileChatOpen(true);
    setIsTyping(false);
  };

  
  useEffect(() => {
    if (selectedUser?.conversationId && socketRef.current?.connected) {
      socketRef.current.emit("join_conversation", selectedUser.conversationId);
    }

    setIsTyping(false);
  }, [selectedUser]);

  
  useEffect(() => {
    if (!userdata?._id) return;

    const fetchData = async () => {
      setLoading(true);

      try {
        const [chatsResponse, usersResponse] = await Promise.all([
          axios.get(`${ServerUrl}/api/previouschat`, {
            withCredentials: true,
          }),

          axios.get(`${ServerUrl}/api/allusers`, {
            withCredentials: true,
          }),
        ]);

        setPreviousChats(
          Array.isArray(chatsResponse.data) ? chatsResponse.data : [],
        );

        setAllUsers(
          Array.isArray(usersResponse.data) ? usersResponse.data : [],
        );
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userdata?._id]);


  const fetchMessages = useCallback(async (userId) => {
    try {
      setMessages([]);

      const response = await axios.get(`${ServerUrl}/api/getallmsg/${userId}`, {
        withCredentials: true,
      });

      setMessages(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Fetch messages error:", error);
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    if (selectedUser?._id) {
      fetchMessages(selectedUser._id);
    } else {
      setMessages([]);
    }
  }, [selectedUser, fetchMessages]);

  
  const emitTyping = useCallback(
    (typing) => {
      if (
        !socketRef.current?.connected ||
        !selectedUser?.conversationId ||
        !userdata?._id
      ) {
        return;
      }

      socketRef.current.emit(typing ? "typing_start" : "typing_stop", {
        conversationId: selectedUser.conversationId,
        userId: userdata._id,
      });
    },
    [selectedUser, userdata?._id],
  );

  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    clearTimeout(typingTimeoutRef.current);

    if (value.trim()) {
      emitTyping(true);

      typingTimeoutRef.current = setTimeout(() => {
        emitTyping(false);
      }, 1000);
    } else {
      emitTyping(false);
    }
  };

  
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim() && !image) return;
    if (!selectedUser?._id || sending) return;

    const currentImage = image;
    const currentText = newMessage.trim();

    const tempId = `temp_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 9)}`;

    const optimisticMessage = {
      _id: tempId,
      tempId,
      message: currentText,
      image: currentImage ? "uploading..." : null,
      sender: userdata,
      receiver: selectedUser,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      pending: true,
    };

    try {
      setSending(true);

      setMessages((prev) => [...prev, optimisticMessage]);

      setNewMessage("");
      setImage(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      emitTyping(false);
      clearTimeout(typingTimeoutRef.current);

      const formData = new FormData();

      if (currentText) {
        formData.append("message", currentText);
      }

      if (currentImage) {
        formData.append("image", currentImage);
      }

      const response = await axios.post(
        `${ServerUrl}/api/sendmsg/${selectedUser._id}`,
        formData,
        {
          withCredentials: true,
        },
      );

      const sentMessage = response.data;

      setMessages((prev) =>
        prev.map((msg) => (msg.tempId === tempId ? sentMessage : msg)),
      );

      updatePreviousChatsWithMessage(sentMessage);

      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Send message error:", error);

      setMessages((prev) => prev.filter((msg) => msg.tempId !== tempId));

      alert(error?.response?.data?.error || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB");
      e.target.value = "";
      return;
    }

    setImage(file);
  };

  const removeImage = () => {
    setImage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };


  const filteredUsers = allUsers.filter((user) => {
    const search = searchTerm.toLowerCase();

    return (
      user._id !== userdata?._id &&
      (user.username?.toLowerCase().includes(search) ||
        user.name?.toLowerCase().includes(search) ||
        user.email?.toLowerCase().includes(search))
    );
  });

  
  const closeNewChat = () => {
    setShowNewChat(false);
    setSearchTerm("");
  };

  return (
    <div className="w-full max-w-full h-[100dvh] min-h-0 flex bg-black text-white overflow-hidden">
    
      <div className="hidden lg:block w-[250px] xl:w-[270px] shrink-0 h-full overflow-hidden">
        <Lefthome />
      </div>

     
      <div className="flex-1 min-w-0 max-w-full h-full flex overflow-hidden">
        
        <aside
          className={`
            w-full md:w-[280px] lg:w-[300px] xl:w-[330px]
            md:max-w-[40%] shrink-0
            border-r border-gray-800 bg-black
            flex-col min-h-0 min-w-0 overflow-hidden
            ${mobileChatOpen ? "hidden md:flex" : "flex"}
          `}
        >
        
          <div className="p-4 sm:p-5 border-b border-gray-800 shrink-0">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-xl sm:text-2xl font-bold">Messages</h2>

              <span className="text-xs text-gray-400 whitespace-nowrap">
                {previousChats.length} Chats
              </span>
            </div>

            <button
              onClick={() => setShowNewChat(true)}
              className="w-full min-w-0 flex items-center justify-center gap-2 py-3 px-3 rounded-xl border border-gray-700 hover:bg-white hover:text-black transition text-sm font-semibold"
            >
              <Icon name="plus" size={18} />
              <span>New Chat</span>
            </button>
          </div>

         
          {loading && previousChats.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Loading chats...
            </div>
          ) : previousChats.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-5 text-center text-gray-400">
              <Icon name="message" size={45} />

              <p className="mt-3 text-sm">No conversations yet</p>

              <button
                onClick={() => setShowNewChat(true)}
                className="mt-4 px-4 py-2 border border-gray-700 rounded-lg hover:bg-white hover:text-black text-sm"
              >
                Start Chatting
              </button>
            </div>
          ) : (
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain">
              {previousChats.map((user) => (
                <button
                  type="button"
                  key={user._id}
                  onClick={() => selectChat(user)}
                  className={`
                    w-full min-w-0 p-3 sm:p-4
                    flex items-center gap-3 text-left
                    border-b border-gray-900
                    hover:bg-gray-900 transition
                    ${selectedUser?._id === user._id ? "bg-gray-900" : ""}
                  `}
                >
                  <div className="relative shrink-0">
                    {getProfilePic(user) ? (
                      <img
                        src={getProfilePic(user)}
                        alt={getDisplayName(user)}
                        className="w-11 h-11 rounded-full object-cover border border-gray-700"
                      />
                    ) : (
                      <div
                        className={`
                        w-11 h-11 rounded-full flex items-center
                        justify-center font-semibold
                        ${getAvatarColor(user._id)}
                      `}
                      >
                        {getUserInitials(user)}
                      </div>
                    )}

                    {isUserOnline(user._id) && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-black" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="font-semibold text-sm truncate">
                        {getDisplayName(user)}
                      </span>

                      <span className="text-[10px] text-gray-500 shrink-0">
                        {user.lastMessage
                          ? formatTime(user.lastMessage.createdAt)
                          : ""}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 truncate mt-1">
                      {user.lastMessage
                        ? user.lastMessage.image
                          ? "Image"
                          : user.lastMessage.message
                        : "No messages yet"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

     
        <main
          className={`
            flex-1 min-w-0 max-w-full min-h-0
            flex-col bg-black overflow-hidden
            ${mobileChatOpen ? "flex" : "hidden md:flex"}
          `}
        >
          {selectedUser ? (
            <>
             
              <header className="h-[70px] sm:h-[76px] shrink-0 px-2 sm:px-5 border-b border-gray-800 flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  onClick={() => setMobileChatOpen(false)}
                  className="md:hidden shrink-0 w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-800"
                  aria-label="Back to conversations"
                >
                  <Icon name="back" size={21} />
                </button>

                <div className="relative shrink-0">
                  {getProfilePic(selectedUser) ? (
                    <img
                      src={getProfilePic(selectedUser)}
                      alt={getDisplayName(selectedUser)}
                      className="w-10 h-10 rounded-full object-cover border border-gray-700"
                    />
                  ) : (
                    <div
                      className={`
                      w-10 h-10 rounded-full flex items-center
                      justify-center font-semibold
                      ${getAvatarColor(selectedUser._id)}
                    `}
                    >
                      {getUserInitials(selectedUser)}
                    </div>
                  )}

                  {isUserOnline(selectedUser._id) && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-black" />
                  )}
                </div>

                <div className="flex-1 min-w-0 overflow-hidden">
                  <h3 className="font-semibold text-sm sm:text-base truncate">
                    {getDisplayName(selectedUser)}
                  </h3>

                  <p
                    className={`text-xs mt-0.5 ${
                      isUserOnline(selectedUser._id)
                        ? "text-green-500"
                        : "text-gray-400"
                    }`}
                  >
                    {isUserOnline(selectedUser._id) ? "Online" : "Offline"}
                  </p>
                </div>
              </header>

             
              <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain">
                <div className="w-full min-w-0 p-3 sm:p-5">
                  {messages.length === 0 ? (
                    <div className="min-h-[300px] flex flex-col items-center justify-center text-center text-gray-400">
                      <Icon name="message" size={48} />

                      <p className="mt-4 font-medium text-white">
                        No messages yet
                      </p>

                      <p className="mt-2 text-xs sm:text-sm">
                        Send a message to start chatting.
                      </p>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const isMine = message.sender?._id === userdata?._id;

                      return (
                        <div
                          key={message._id || message.tempId}
                          className={`w-full min-w-0 flex mb-3 ${
                            isMine ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`
                              w-fit min-w-0 max-w-[85%] sm:max-w-[75%]
                              md:max-w-[70%] overflow-hidden
                              px-3 sm:px-4 py-3 rounded-2xl
                              break-words
                              ${
                                isMine
                                  ? "bg-blue-600 text-white rounded-br-sm"
                                  : "bg-gray-800 text-white border border-gray-700 rounded-bl-sm"
                              }
                              ${message.isOptimistic ? "opacity-80" : ""}
                            `}
                          >
                            {/* Image */}
                            {message.image &&
                              message.image !== "uploading..." && (
                                <img
                                  src={getImageUrl(message.image)}
                                  alt="Shared image"
                                  className="block w-auto max-w-full max-h-64 sm:max-h-80 object-contain rounded-lg mb-2 cursor-pointer"
                                  onClick={() =>
                                    window.open(
                                      getImageUrl(message.image),
                                      "_blank",
                                      "noopener,noreferrer",
                                    )
                                  }
                                />
                              )}

                           
                            {message.image === "uploading..." && (
                              <div className="w-full min-w-[130px] p-5 bg-gray-700 rounded-lg text-center text-xs">
                                Uploading image...
                              </div>
                            )}

                           
                            {message.message && (
                              <p className="text-sm sm:text-base whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                                {message.message}
                              </p>
                            )}

                           
                            <div className="flex justify-end items-center gap-1 text-[10px] opacity-70 mt-2">
                              {formatTime(message.createdAt)}

                              {message.isOptimistic && <span>Sending...</span>}

                              {!message.isOptimistic && isMine && (
                                <Icon name="check" size={13} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  
                  {isTyping && (
                    <div className="flex justify-start mb-3">
                      <div className="px-4 py-3 rounded-2xl bg-gray-800 border border-gray-700 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />

                        <span className="text-xs text-gray-400">Typing...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

             
              {image && (
                <div className="px-3 sm:px-4 py-2 border-t border-gray-800 shrink-0 bg-gray-950">
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />

                      <div className="min-w-0">
                        <p className="text-xs text-white truncate">
                          {image.name}
                        </p>

                        <p className="text-[10px] text-gray-500">
                          Ready to send
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={removeImage}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-red-400 hover:bg-gray-800 shrink-0"
                      aria-label="Remove image"
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                </div>
              )}

              
              <form
                onSubmit={handleSendMessage}
                className="w-full min-w-0 shrink-0 border-t border-gray-800 bg-black px-2 sm:px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
              >
                <div className="w-full min-w-0 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />

                  
                  <input
                    type="text"
                    value={newMessage}
                    onChange={handleInputChange}
                    placeholder="Type a message..."
                    disabled={sending}
                    className="flex-1 min-w-0 w-0 h-10 sm:h-11 rounded-full px-3 sm:px-4 bg-gray-950 border border-gray-800 text-white text-sm outline-none focus:border-blue-500 placeholder:text-gray-500"
                  />

                 
                  <button
                    type="submit"
                    disabled={(!newMessage.trim() && !image) || sending}
                    className="h-10 sm:h-11 px-3 sm:px-5 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    aria-label="Send message"
                  >
                    <Icon name="send" size={17} />

                    <span className="hidden sm:inline text-sm font-medium">
                      {sending ? "Sending..." : "Send"}
                    </span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-5 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center">
                <Icon name="message" size={32} />
              </div>

              <h3 className="text-lg sm:text-xl font-semibold mt-5">
                Welcome to Messages
              </h3>

              <p className="text-sm text-gray-400 mt-2 max-w-xs">
                Select a conversation to start chatting with someone.
              </p>

              <button
                onClick={() => setShowNewChat(true)}
                className="mt-5 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold"
              >
                Start New Conversation
              </button>
            </div>
          )}
        </main>
      </div>

      {showNewChat && (
        <div
          className="fixed inset-0 z-[100] w-full h-[100dvh] bg-black/80 flex items-center justify-center p-3 sm:p-5"
          onClick={closeNewChat}
        >
          <div
            className="w-full max-w-md max-h-[85dvh] flex flex-col min-w-0 bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
              <div className="min-w-0">
                <h3 className="font-semibold text-lg">New Chat</h3>

                <p className="text-xs text-gray-500 mt-1">
                  Select a user to start messaging.
                </p>
              </div>

              <button
                onClick={closeNewChat}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-800 shrink-0"
                aria-label="Close new chat"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            
            <div className="p-3 sm:p-4 border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2 px-3 rounded-xl border border-gray-800 bg-black">
                <Icon
                  name="search"
                  size={18}
                  className="text-gray-500 shrink-0"
                />

                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full min-w-0 h-11 bg-transparent outline-none text-sm text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2">
              {filteredUsers.length === 0 ? (
                <div className="p-8 flex flex-col items-center text-center text-gray-400">
                  <Icon name="search" size={32} />

                  <p className="mt-3 text-sm">
                    {searchTerm ? "No users found" : "No users available"}
                  </p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    type="button"
                    key={user._id}
                    onClick={() => {
                      selectChat(user);
                      closeNewChat();
                    }}
                    className="w-full min-w-0 p-3 rounded-xl flex items-center gap-3 text-left hover:bg-gray-900 transition"
                  >
                    <div className="shrink-0">
                      {getProfilePic(user) ? (
                        <img
                          src={getProfilePic(user)}
                          alt={getDisplayName(user)}
                          className="w-11 h-11 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className={`
                          w-11 h-11 rounded-full flex items-center
                          justify-center font-semibold
                          ${getAvatarColor(user._id)}
                        `}
                        >
                          {getUserInitials(user)}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {getDisplayName(user)}
                      </p>

                      <p className="text-xs text-gray-500 truncate mt-1">
                        {user.email || "User"}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
