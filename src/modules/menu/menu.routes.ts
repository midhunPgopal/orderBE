import express from "express";
import { addMenuItem, deleteMenuItem, getMenuItemById, getMenuItems, updateMenuItem } from "./menu.controller";
import { authorizeAdmin } from "../../middlewares/role.middleware";

const router = express.Router();

// Admin can add a menu item
router.post("/create", authorizeAdmin, addMenuItem);

// Public endpoint: search, filter, pagination
router.get("/", getMenuItems);

// Public endpoint: get menu item by ID
router.get("/menu/:menuId", getMenuItemById);

// Update menu item (Admin only)
router.put("/:id", authorizeAdmin, updateMenuItem);

// Delete menu item (Admin only)
router.delete("/:id", authorizeAdmin, deleteMenuItem);

export default router;
