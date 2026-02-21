// controllers/paymentController.ts
import { Request, Response } from "express";
import { razorpay } from "../../config/razorpay";
import crypto from "crypto";
import { pool } from "../../config/db";
import { OrderStatus, PaymmentStatus } from "../../models/role";
import { getIO } from "../../sockets/socket";

export const createRazorpayOrder = async (req: Request, res: Response) => {
    const connection = await pool.getConnection(); // dedicated connection for transaction
    try {
        const userId = (req as any).user.id;
        const { amount, cart, notes } = req.body;

        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ message: "No items provided" });
        }

        await connection.beginTransaction(); // start transaction

        // 1️⃣ Check stock for all items BEFORE creating the order
        for (const item of cart) {
            const [rows] = await connection.query(
                `SELECT stock, name FROM menu_items WHERE id = ? FOR UPDATE`,
                [item.id]
            );

            if ((rows as any).length === 0) {
                throw new Error(`Menu item with id ${item.id} not found`);
            }

            const menuItem = (rows as any)[0];
            if (menuItem.stock < item.quantity) {
                throw new Error(`Not enough stock for "${menuItem.name}"`);
            }
        }

        // 2️⃣ Create Razorpay order
        const options = {
            amount: amount * 100, // Razorpay uses paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };
        const order = await razorpay.orders.create(options);

        // 3️⃣ Create order in DB with payment_status = PENDING
        const [orderResult] = await connection.query(
            `INSERT INTO orders 
      (odr_id, user_id, total_amount, status, payment_method, payment_status, payment_id, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                order.id,
                userId,
                amount,
                OrderStatus.PAYMENT_PENDING,
                "RAZORPAY",
                PaymmentStatus.PENDING,
                null,
                notes || null,
            ]
        );

        const orderId = (orderResult as any).insertId;

        // 4️⃣ Reduce stock and insert order items
        for (const item of cart) {
            // Reduce stock
            await connection.query(
                `UPDATE menu_items SET stock = stock - ? WHERE id = ?`,
                [item.quantity, item.id]
            );

            // Insert into order_items
            await connection.query(
                `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) 
         VALUES (?, ?, ?, ?)`,
                [orderId, item.id, item.quantity, item.price]
            );
        }

        await connection.commit(); // commit transaction

        //websocket
        const io = getIO();
        io.to("kitchen-room").emit("new-order");

        res.status(200).json(order);
    } catch (error) {
        await connection.rollback(); // rollback if any error
        console.error(error);
        res.status(400).json({ message: "Failed to create order", error: (error as any).message });
    } finally {
        connection.release(); // release connection
    }
};

export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const { orderId, paymentResult } = req.body;
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = paymentResult;

        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        let paymentSuccess = generatedSignature === razorpay_signature;
        const paymentStatus = paymentSuccess ? PaymmentStatus.COMPLETED : PaymmentStatus.FAILED;
        const orderStatus = paymentSuccess ? OrderStatus.ORDER_RECEIVED : OrderStatus.PAYMENT_PENDING;

        await pool.query(`UPDATE orders SET payment_status = ?, payment_id = ?, status = ?
            WHERE odr_id = ?`,
            [paymentStatus, razorpay_payment_id, orderStatus, orderId]
        );

        //websocket
        const io = getIO();
        io.to("kitchen-room").emit("order-paid", { orderId, orderStatus, paymentStatus });

        return res.status(paymentSuccess ? 200 : 400)
            .json({ success: paymentSuccess })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Verification failed" });
    }
};