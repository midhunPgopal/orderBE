import request from "supertest";

describe("Server Unit Tests", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        process.env.NODE_ENV = "test";
    });

    describe("startServer()", () => {
        it("should call connectDB, initSocket and listen", async () => {
            const connectDBMock = jest.fn().mockResolvedValue(undefined);
            const initSocketMock = jest.fn();

            jest.doMock("../src/config/db", () => ({
                connectDB: connectDBMock,
                pool: {
                    end: jest.fn(),
                    query: jest.fn(),
                },
            }));

            jest.doMock("../src/sockets/socket", () => ({
                initSocket: initSocketMock,
            }));

            const { startServer, server } = await import("../src/server");

            const listenSpy = jest
                .spyOn(server, "listen")
                .mockImplementation((port: any, cb: any) => {
                    cb();
                    return server;
                });

            await startServer();

            expect(connectDBMock).toHaveBeenCalledTimes(1);
            expect(initSocketMock).toHaveBeenCalledTimes(1);
            expect(listenSpy).toHaveBeenCalledTimes(1);

            listenSpy.mockRestore();
        });

        it("should exit process if DB connection fails", async () => {
            const connectDBMock = jest
                .fn()
                .mockRejectedValue(new Error("DB failed"));

            const exitSpy = jest
                .spyOn(process, "exit")
                .mockImplementation((() => { }) as never);

            jest.doMock("../src/config/db", () => ({
                connectDB: connectDBMock,
                pool: {
                    end: jest.fn(),
                    query: jest.fn(),
                },
            }));

            jest.doMock("../src/sockets/socket", () => ({
                initSocket: jest.fn(),
            }));

            const { startServer } = await import("../src/server");

            await startServer();

            expect(connectDBMock).toHaveBeenCalled();
            expect(exitSpy).toHaveBeenCalledWith(1);

            exitSpy.mockRestore();
        });
    });

    describe("registerShutdown()", () => {
        beforeEach(() => {
            jest.resetModules();
            process.env.NODE_ENV = "test";
        });

        it("should close DB pool and server on SIGINT", async () => {
            const poolEndMock = jest.fn().mockResolvedValue(undefined);

            jest.doMock("../src/config/db", () => ({
                connectDB: jest.fn(),
                pool: {
                    end: poolEndMock,
                    query: jest.fn(),
                },
            }));

            const { registerShutdown, server } = await import("../src/server");

            const closeSpy = jest
                .spyOn(server, "close")
                .mockImplementation((cb: any) => {
                    cb();
                    return server;
                });

            const exitSpy = jest
                .spyOn(process, "exit")
                .mockImplementation((() => { }) as never);

            registerShutdown();

            process.emit("SIGINT");

            // 🔥 wait for async handler to finish
            await new Promise((resolve) => setImmediate(resolve));

            expect(poolEndMock).toHaveBeenCalledTimes(1);
            expect(closeSpy).toHaveBeenCalledTimes(1);
            expect(exitSpy).toHaveBeenCalledWith(0);

            closeSpy.mockRestore();
            exitSpy.mockRestore();
        });
    });

    describe("Auto execution (non-test env)", () => {
        it("should auto start server and register shutdown", async () => {
            process.env.NODE_ENV = "development";

            const connectDBMock = jest.fn().mockResolvedValue(undefined);
            const initSocketMock = jest.fn();

            jest.doMock("../src/config/db", () => ({
                connectDB: connectDBMock,
                pool: {
                    end: jest.fn(),
                    query: jest.fn(),
                },
            }));

            jest.doMock("../src/sockets/socket", () => ({
                initSocket: initSocketMock,
            }));

            await import("../src/server");

            expect(connectDBMock).toHaveBeenCalled();
            expect(initSocketMock).toHaveBeenCalled();

            process.env.NODE_ENV = "test";
        });
    });

    describe("/health route", () => {
        it("should return 200 when DB is connected", async () => {
            const mockDate = new Date();

            jest.doMock("../src/config/db", () => ({
                connectDB: jest.fn(),
                pool: {
                    query: jest.fn().mockResolvedValue([[{ now: mockDate }]]),
                    end: jest.fn(),
                },
            }));

            const { app } = await import("../src/server");

            const res = await request(app).get("/health");

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("OK");
            expect(res.body.database).toBe("Connected");
            expect(res.body).toHaveProperty("uptime");
            expect(res.body).toHaveProperty("timestamp");
        });

        it("should return 500 when DB fails", async () => {
            jest.doMock("../src/config/db", () => ({
                connectDB: jest.fn(),
                pool: {
                    query: jest.fn().mockRejectedValue(new Error("DB error")),
                    end: jest.fn(),
                },
            }));

            const { app } = await import("../src/server");

            const res = await request(app).get("/health");

            expect(res.status).toBe(500);
            expect(res.body.status).toBe("ERROR");
            expect(res.body.database).toBe("Disconnected");
        });
    });
});