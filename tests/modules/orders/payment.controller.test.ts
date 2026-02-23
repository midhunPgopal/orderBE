import { createRazorpayOrder, verifyPayment } from "../../../src/modules/orders/payment.controller";
import { OrderStatus, PaymmentStatus } from "../../../src/models/role";

jest.mock("../../../src/config/db");
jest.mock("../../../src/config/razorpay", () => ({
  razorpay: {
    orders: {
      create: jest.fn(),
    },
  },
}));
jest.mock("../../../src/sockets/socket");

import { pool } from "../../../src/config/db";
import { razorpay } from "../../../src/config/razorpay";
import { getIO } from "../../../src/sockets/socket";

describe("Payment Controller Unit Tests", () => {
  let mockConnection: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConnection = {
      beginTransaction: jest.fn(),
      query: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    (pool.getConnection as jest.Mock).mockResolvedValue(mockConnection);

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    (getIO as jest.Mock).mockReturnValue({
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    });
  });

  describe("createRazorpayOrder()", () => {
    const mockReq: any = {
      user: { id: 1 },
      body: {
        amount: 500,
        cart: [{ id: 1, quantity: 2, price: 250 }],
        notes: "Test order",
      },
    };

    it("should create order successfully", async () => {
      mockConnection.query
        // Stock check
        .mockResolvedValueOnce([[{ stock: 10, name: "Burger" }]])
        // Insert order
        .mockResolvedValueOnce([{ insertId: 100 }])
        // Update stock
        .mockResolvedValueOnce([])
        // Insert order item
        .mockResolvedValueOnce([]);

      (razorpay.orders.create as jest.Mock).mockResolvedValue({
        id: "razorpay_order_123",
      });

      await createRazorpayOrder(mockReq, mockRes);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(razorpay.orders.create).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should return 400 if cart is empty", async () => {
      const req: any = {
        user: { id: 1 },
        body: { amount: 500, cart: [] },
      };

      await createRazorpayOrder(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "No items provided",
      });
    });

    it("should rollback if stock is insufficient", async () => {
      mockConnection.query.mockResolvedValueOnce([[{ stock: 1, name: "Burger" }]]);

      await createRazorpayOrder(mockReq, mockRes);

      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it("should rollback if DB insert fails", async () => {
      mockConnection.query
        .mockResolvedValueOnce([[{ stock: 10, name: "Burger" }]])
        .mockRejectedValueOnce(new Error("DB error"));

      (razorpay.orders.create as jest.Mock).mockResolvedValue({
        id: "razorpay_order_123",
      });

      await createRazorpayOrder(mockReq, mockRes);

      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe("verifyPayment()", () => {
    const baseBody = {
      orderId: "razorpay_order_123",
      paymentResult: {
        razorpay_order_id: "razorpay_order_123",
        razorpay_payment_id: "payment_123",
        razorpay_signature: "valid_signature",
      },
    };

    let cryptoSpy: any;

    beforeEach(() => {
      cryptoSpy = jest.spyOn(require("crypto"), "createHmac");
    });

    afterEach(() => {
      cryptoSpy.mockRestore();
    });

    it("should verify payment successfully", async () => {
      const mockDigest = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue("valid_signature"),
      };

      cryptoSpy.mockReturnValue(mockDigest);

      (pool.query as jest.Mock).mockResolvedValue([]);

      const req: any = { body: baseBody };

      await verifyPayment(req, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE orders"),
        [
          PaymmentStatus.COMPLETED,
          "payment_123",
          OrderStatus.ORDER_RECEIVED,
          "razorpay_order_123",
        ]
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    it("should mark payment failed if signature mismatch", async () => {
      const mockDigest = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue("wrong_signature"),
      };

      cryptoSpy.mockReturnValue(mockDigest);

      (pool.query as jest.Mock).mockResolvedValue([]);

      const req: any = { body: baseBody };

      await verifyPayment(req, mockRes);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE orders"),
        [
          PaymmentStatus.FAILED,
          "payment_123",
          OrderStatus.PAYMENT_PENDING,
          "razorpay_order_123",
        ]
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ success: false });
    });

    it("should return 500 if DB update fails", async () => {
      const mockDigest = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue("valid_signature"),
      };

      cryptoSpy.mockReturnValue(mockDigest);

      (pool.query as jest.Mock).mockRejectedValue(
        new Error("DB failure")
      );

      const req: any = { body: baseBody };

      await verifyPayment(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Verification failed",
      });
    });
  });
});