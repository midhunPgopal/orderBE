import { Server } from "socket.io";

let io: Server;

export const initSocket = (server: any) => {
  io = new Server(server, {
    cors: { origin: "http://localhost:3000" },
  });

  io.on("connection", (socket) => {
    socket.on("join-order-room", (orderId: string) => {
      socket.join(`order-${orderId}`);
    });

    socket.on("join-kitchen", () => {
      socket.join("kitchen-room");
    });
  });
};

export const getIO = () => io;
