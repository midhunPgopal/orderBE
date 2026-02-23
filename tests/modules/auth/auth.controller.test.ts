import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../../../src/config/db";
import {
  signup,
  signin,
  refreshToken,
  logout,
} from "../../../src/modules/auth/auth.controller";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../../src/utils/token";

jest.mock("../../../src/config/db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock("bcrypt");
jest.mock("jsonwebtoken");
jest.mock("../../../src/utils/token");

describe("Auth Controller Unit Tests", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
  });

  describe("signup()", () => {
    it("should return 400 if fields are missing", async () => {
      mockReq = { body: {} };

      await signup(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 for invalid email", async () => {
      mockReq = {
        body: {
          firstName: "A",
          lastName: "B",
          email: "invalid",
          phone: "1234567",
          password: "pass",
          role: "USER",
        },
      };

      await signup(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should return 409 if email exists", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce([[{ id: 1 }]]);

      mockReq = {
        body: {
          firstName: "A",
          lastName: "B",
          email: "test@test.com",
          phone: "1234567890",
          password: "pass",
          role: "USER",
        },
      };

      await signup(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(409);
    });

    it("should create user successfully", async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce([[]]) // email check
        .mockResolvedValueOnce([{}]); // insert

      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed");

      mockReq = {
        body: {
          firstName: "A",
          lastName: "B",
          email: "test@test.com",
          phone: "1234567890",
          password: "pass",
          role: "USER",
        },
      };

      await signup(mockReq as Request, mockRes as Response);

      expect(bcrypt.hash).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe("signin()", () => {
    it("should return 400 if email/password missing", async () => {
      mockReq = { body: {} };

      await signin(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 if user not found", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce([[]]);

      mockReq = {
        body: { email: "test@test.com", password: "pass" },
      };

      await signin(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 if password mismatch", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce([
        [{ id: 1, password: "hashed" }],
      ]);

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      mockReq = {
        body: { email: "test@test.com", password: "wrong" },
      };

      await signin(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should login successfully", async () => {
      const user = {
        id: 1,
        password: "hashed",
        role: "USER",
        first_name: "A",
        last_name: "B",
        email: "test@test.com",
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce([[user]]) // find user
        .mockResolvedValueOnce([{}]); // update refresh token

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (generateAccessToken as jest.Mock).mockReturnValue("access");
      (generateRefreshToken as jest.Mock).mockReturnValue("refresh");

      mockReq = {
        body: { email: "test@test.com", password: "pass" },
      };

      await signin(mockReq as Request, mockRes as Response);

      expect(mockRes.cookie).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe("refreshToken()", () => {
    it("should return 401 if no cookie", async () => {
      mockReq = { cookies: {} };

      await refreshToken(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 403 if token invalid in DB", async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 1 });
      (pool.query as jest.Mock).mockResolvedValueOnce([[]]);

      mockReq = {
        cookies: { refreshToken: "token" },
      };

      await refreshToken(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it("should refresh successfully", async () => {
      const user = { id: 1, role: "USER" };

      (jwt.verify as jest.Mock).mockReturnValue({ id: 1 });

      (pool.query as jest.Mock)
        .mockResolvedValueOnce([[user]]) // check token
        .mockResolvedValueOnce([{}]); // update rotated token

      (generateAccessToken as jest.Mock).mockReturnValue("newAccess");
      (generateRefreshToken as jest.Mock).mockReturnValue("newRefresh");

      mockReq = {
        cookies: { refreshToken: "oldToken" },
      };

      await refreshToken(mockReq as Request, mockRes as Response);

      expect(mockRes.cookie).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe("logout()", () => {
    it("should clear cookie and logout", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce([{}]);

      mockReq = {
        cookies: { refreshToken: "token" },
      };

      await logout(mockReq as Request, mockRes as Response);

      expect(mockRes.clearCookie).toHaveBeenCalledWith("refreshToken");
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});