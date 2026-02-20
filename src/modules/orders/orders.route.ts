import express from "express";
import {
  createOrder,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  getOrderById,
} from "./orders.controller";
import { authorizeAdmin } from "../../middlewares/role.middleware";

const router = express.Router();

// User creates order
router.post("/create", createOrder);

// User gets their own orders
router.get("/my-orders", getUserOrders);

// Admin: get all orders
router.get("/all", authorizeAdmin, getAllOrders);

// Admin: update order status
router.put("/:orderId/status", authorizeAdmin, updateOrderStatus);

// User or Admin can fetch order by ID
router.get("/orders/:orderId", getOrderById);

export default router;
