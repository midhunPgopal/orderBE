import express from "express";
import {
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  getOrderById,
  validateCart,
} from "./orders.controller";
import { authorizeAdmin } from "../../middlewares/role.middleware";
import { createRazorpayOrder, verifyPayment } from "./payment.controller";

const router = express.Router();

// User gets their own orders
router.get("/my-orders", getUserOrders);

// Admin: get all orders
router.get("/all", authorizeAdmin, getAllOrders);

// Admin: update order status
router.put("/:orderId/status", authorizeAdmin, updateOrderStatus);

// User or Admin can fetch order by ID
router.get("/:orderId", getOrderById);

router.post("/create-order", createRazorpayOrder);

router.post("/verify-payment", verifyPayment);

router.post("/validateCart", validateCart)

export default router;
