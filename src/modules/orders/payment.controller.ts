// controllers/paymentController.ts
import { Request, Response } from "express";
import { razorpay } from "../../config/razorpay";
import crypto from "crypto";
import { pool } from "../../config/db";
import { OrderStatus, PaymmentStatus } from "../../models/role";

export const createRazorpayOrder = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { amount, cart, notes } = req.body;

        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ message: "No items provided" });
        }

        const options = {
            amount: amount * 100, // Razorpay uses paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };
        const order = await razorpay.orders.create(options);

        // 2️⃣ Create order in DB with payment_status = PENDING
        const [orderResult] = await pool.query(
            `INSERT INTO orders (odr_id, user_id, total_amount, status, payment_method, 
            payment_status, payment_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [order.id, userId, amount, OrderStatus.PAYMENT_PENDING,
                "RAZORPAY", PaymmentStatus.PENDING, null, notes || null]
        );

        const orderId = (orderResult as any).insertId;

        // 3️⃣ Insert order items
        const orderItemsValues = cart.map(
            (item: any) => [orderId, item.id, item.quantity, item.price]
        );

        await pool.query(
            `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time)
       VALUES ?`,
            [orderItemsValues]
        );
        res.status(200).json(order);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to create order" });
    }
}

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
        return res.status(paymentSuccess ? 200 : 400)
            .json({ success: paymentSuccess })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Verification failed" });
    }
};