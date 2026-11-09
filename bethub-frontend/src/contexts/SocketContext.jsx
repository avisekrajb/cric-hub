import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL, getToken } from "../lib/api";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(0);
  const [serverOffset, setServerOffset] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    const instance = io(SOCKET_URL, {
      path: "/socket.io",
      auth: { token: token || getToken() || undefined },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 6000,
      timeout: 12000,
    });
    socketRef.current = instance;
    setSocket(instance);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnected = (payload) => {
      if (payload?.serverTime) setServerOffset(Date.now() - new Date(payload.serverTime).getTime());
    };
    const onPresence = (payload) => setOnline(payload?.online || 0);

    instance.on("connect", onConnect);
    instance.on("disconnect", onDisconnect);
    instance.on("connected", onConnected);
    instance.on("presence:update", onPresence);
    instance.on("connect_error", () => setConnected(false));

    return () => {
      instance.off("connect", onConnect);
      instance.off("disconnect", onDisconnect);
      instance.off("connected", onConnected);
      instance.off("presence:update", onPresence);
      instance.off("connect_error");
      instance.disconnect();
      socketRef.current = null;
    };
  }, [token, user?._id]);

  const value = useMemo(
    () => ({
      socket,
      connected,
      online,
      serverOffset,
      joinMatch: (matchId) => socketRef.current?.emit("match:join", { matchId }),
      leaveMatch: (matchId) => socketRef.current?.emit("match:leave", { matchId }),
      joinStream: (matchId) => socketRef.current?.emit("stream:join", { matchId }),
      leaveStream: (matchId) => socketRef.current?.emit("stream:leave", { matchId }),
    }),
    [socket, connected, online, serverOffset]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used inside SocketProvider");
  return ctx;
};

export function useSocketEvent(event, handler, deps = []) {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket || !event) return undefined;
    const listener = (...args) => handlerRef.current?.(...args);
    socket.on(event, listener);
    return () => socket.off(event, listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, event, ...deps]);
}
