import crypto from "node:crypto";
import logger from "../config/logger.js";

let ioRef = null;

export const setIO = (io) => {
  ioRef = io;
};

export const getIO = () => ioRef;

export const rooms = {
  global: "global",
  admin: "admin",
  match: (id) => `match:${id}`,
  broadcaster: (id) => `broadcast:${id}`,
};

export const emitGlobal = (event, payload) => {
  if (!ioRef) return;
  ioRef.to(rooms.global).emit(event, payload);
};

export const emitAdmin = (event, payload) => {
  if (!ioRef) return;
  ioRef.to(rooms.admin).emit(event, payload);
};

export const emitMatch = (matchId, event, payload) => {
  if (!ioRef) return;
  ioRef.to(rooms.match(String(matchId))).emit(event, payload);
};

export const emitAll = (event, payload) => {
  if (!ioRef) return;
  ioRef.emit(event, payload);
};

export const notify = (payload) => {
  const notification = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    ...payload,
  };
  emitGlobal("notification", notification);
  return notification;
};

export const safeEmit = (event, payload) => {
  try {
    emitGlobal(event, payload);
  } catch (error) {
    logger.warn("emit failed", event, error.message);
  }
};
