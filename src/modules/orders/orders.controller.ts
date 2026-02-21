import { Request, Response } from "express";
import { pool } from "../../config/db";

// Get Orders for logged-in user (with pagination)
export const getUserOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { page = "1", limit = "10", status } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const offset = (pageNum - 1) * limitNum;

    let baseQuery = `FROM orders WHERE user_id = ?`;
    const params: any[] = [userId];

    if (status) {
      baseQuery += ` AND order_status = ?`;
      params.push(status);
    }

    // Total count with filter
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total ${baseQuery}`,
      params
    );
    const total = (countRows as any)[0].total;

    // Fetch paginated results
    const [rows] = await pool.query(
      `SELECT *, COALESCE(updated_at, created_at) AS sort_date
       ${baseQuery}
       ORDER BY sort_date DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    return res.status(200).json({
      data: rows,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

//Get all orders (admin, with pagination)
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "10", status } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const offset = (pageNum - 1) * limitNum;

    let baseQuery = `FROM orders WHERE 1=1`;
    const params: any[] = [];

    if (status) {
      baseQuery += ` AND order_status = ?`;
      params.push(status);
    }

    // Total count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total ${baseQuery}`,
      params
    );
    const total = (countRows as any)[0].total;

    // Fetch paginated results
    const [rows] = await pool.query(
      `SELECT *, COALESCE(updated_at, created_at) AS sort_date
       ${baseQuery}
       ORDER BY sort_date DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    return res.status(200).json({
      data: rows,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

//Update order status (admin)
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { order_status } = req.body;

    if (!order_status) {
      return res.status(400).json({ message: "Order status is required" });
    }

    await pool.query(
      `UPDATE orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [order_status, orderId]
    );

    return res.status(200).json({ message: "Order status updated" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    if (!(req as any).user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let query = "SELECT * FROM orders WHERE id = ?";
    const params: any[] = [orderId];

    // If user is not admin, restrict to their own orders
    if ((req as any).user.role !== "ADMIN") {
      query += " AND user_id = ?";
      params.push((req as any).user.id);
    }

    const [rows] = await pool.query(query, params);

    if ((rows as any).length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.status(200).json((rows as any)[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};