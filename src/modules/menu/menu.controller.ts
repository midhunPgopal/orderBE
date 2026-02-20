import { Request, Response } from "express";
import { pool } from "../../config/db";

export const addMenuItem = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      image_url,
      price,
      stock,
      preparation_time,
      availability,
      category,
    } = req.body;

    if (!name || !description || !price || !stock || !preparation_time) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Convert category CSV to sorted alphabetical CSV
    let categoryCSV: string | null = null;
    if (category) {
      const categoryArray = category
        .split(",")
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0)
        .sort(); // sort alphabetically
      categoryCSV = categoryArray.join(",");
    }

    const [result] = await pool.query(
      `INSERT INTO menu_items 
       (name, description, image_url, price, stock, preparation_time, availability, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description,
        image_url || null,
        price,
        stock,
        preparation_time,
        availability !== undefined ? availability : true,
        categoryCSV,
      ]
    );

    return res
      .status(201)
      .json({ message: "Menu item added successfully", id: (result as any).insertId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMenuItems = async (req: Request, res: Response) => {
  try {
    const { search, category, minPrice, maxPrice, page = "1", limit = "10" } = req.query;

    let query = "SELECT * FROM menu_items WHERE 1=1";
    const params: any[] = [];

    // Search by name
    if (search) {
      query += " AND name LIKE ?";
      params.push(`%${search}%`);
    }

    // Filter by CSV categories
    if (category) {
      const categoryArray = (category as string).split(",").map((c) => c.trim().toUpperCase());
      query += " AND (";
      query += categoryArray.map(() => "FIND_IN_SET(?, category)").join(" OR ");
      query += ")";
      params.push(...categoryArray);
    }

    // Filter by price
    if (minPrice) {
      query += " AND price >= ?";
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      query += " AND price <= ?";
      params.push(Number(maxPrice));
    }

    // Pagination
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const offset = (pageNum - 1) * limitNum;

    query += " ORDER BY name ASC"; // optional: sort alphabetically
    query += " LIMIT ? OFFSET ?";
    params.push(limitNum, offset);

    const [rows] = await pool.query(query, params);

    // Total count for frontend pagination
    const [countRows] = await pool.query("SELECT COUNT(*) as total FROM menu_items WHERE 1=1");

    return res.status(200).json({
      data: rows,
      page: pageNum,
      limit: limitNum,
      total: (countRows as any)[0].total,
      totalPages: Math.ceil((countRows as any)[0].total / limitNum),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get menu item details by ID
export const getMenuItemById = async (req: Request, res: Response) => {
  try {
    const { menuId } = req.params;

    const [rows] = await pool.query(
      "SELECT * FROM menu_items WHERE id = ?",
      [menuId]
    );

    if ((rows as any).length === 0) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    return res.status(200).json((rows as any)[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateMenuItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const {
      name,
      description,
      image_url,
      price,
      stock,
      preparation_time,
      availability,
      category,
    } = req.body;

    // Check if exists
    const [existing]: any = await pool.query(
      "SELECT id FROM menu_items WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        message: "Menu item not found",
      });
    }

    await pool.query(
      `UPDATE menu_items 
       SET name = ?, 
           description = ?, 
           image_url = ?, 
           price = ?, 
           stock = ?,
           preparation_time = ?, 
           availability = ?, 
           category = ?, 
           updated_at = NOW()
       WHERE id = ?`,
      [
        name,
        description,
        image_url,
        price,
        stock,
        preparation_time,
        availability,
        category,
        id,
      ]
    );

    return res.status(200).json({
      message: "Menu item updated successfully",
    });
  } catch (error) {
    console.error("Update menu error:", error);
    return res.status(500).json({
      message: "Failed to update menu item",
    });
  }
};

export const deleteMenuItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [existing]: any = await pool.query(
      "SELECT id FROM menu_items WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        message: "Menu item not found",
      });
    }

    await pool.query("DELETE FROM menu_items WHERE id = ?", [id]);

    return res.status(200).json({
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    console.error("Delete menu error:", error);
    return res.status(500).json({
      message: "Failed to delete menu item",
    });
  }
};
