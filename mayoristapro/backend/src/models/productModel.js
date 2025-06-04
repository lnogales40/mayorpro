// mayoristapro/backend/src/models/productModel.js
const db = require('../db');

const ProductModel = {
  /**
   * Creates a new product.
   * @param {object} productData - Data for the new product.
   * @param {string} productData.supplier_id - The UUID of the supplier.
   * @param {string} productData.name - Name of the product.
   * @param {string} [productData.description] - Description of the product.
   * @param {string} [productData.image_url] - URL of the product image.
   * @param {number} productData.unit_price - Price per unit.
   * @param {number} [productData.volume_price] - Price per volume (e.g., box).
   * @param {number} productData.stock - Available stock quantity.
   * @returns {Promise<object>} The created product object.
   */
  async create(productData) {
    const {
      supplier_id,
      name,
      description,
      image_url,
      unit_price,
      volume_price,
      stock,
    } = productData;

    if (!supplier_id || !name || unit_price === undefined || stock === undefined) {
      throw new Error('Supplier ID, name, unit price, and stock are required.');
    }

    try {
      const query = `
        INSERT INTO products (supplier_id, name, description, image_url, unit_price, volume_price, stock, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
        RETURNING *;
      `;
      const values = [
        supplier_id,
        name,
        description,
        image_url,
        unit_price,
        volume_price,
        stock,
      ];
      const { rows } = await db.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error creating product:', error);
      if (error.code === '23503') { // Foreign key violation for supplier_id
          throw new Error('Supplier not found for this product.');
      }
      throw error;
    }
  },

  /**
   * Finds a product by its ID.
   * @param {string} id - The UUID of the product.
   * @returns {Promise<object|null>} The product object if found, otherwise null.
   */
  async findById(id) {
    if (!id) return null;
    try {
      // Join with suppliers to get supplier_name
      const query = `
        SELECT p.*, s.name as supplier_name
        FROM products p
        JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.id = $1;
      `;
      const { rows } = await db.query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding product by ID:', error);
      throw error;
    }
  },

  /**
   * Finds all products. Supports filtering by supplier_id, search term (name/description), and active status.
   * Includes basic pagination.
   * @param {object} filters - Optional filters.
   * @param {string} [filters.supplierId] - Filter by supplier's UUID.
   * @param {string} [filters.searchTerm] - Search term for product name or description.
   * @param {boolean} [filters.isActive] - Filter by active status.
   * @param {number} limit - Number of products to return.
   * @param {number} offset - Number of products to skip.
   * @returns {Promise<Array<object>>} A list of product objects.
   */
  async findAll({ supplierId, searchTerm, isActive } = {}, limit = 20, offset = 0) {
    try {
      let query = `
        SELECT p.id, p.supplier_id, s.name as supplier_name, p.name, p.description, p.image_url,
               p.unit_price, p.volume_price, p.stock, p.is_active, p.created_at, p.updated_at
        FROM products p
        JOIN suppliers s ON p.supplier_id = s.id
      `;
      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (supplierId) {
        conditions.push(`p.supplier_id = $${paramIndex++}`);
        values.push(supplierId);
      }
      if (searchTerm) {
        conditions.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
        values.push(`%${searchTerm}%`); // Add wildcards for ILIKE
        paramIndex++;
      }
      if (isActive !== undefined) {
        conditions.push(`p.is_active = $${paramIndex++}`);
        values.push(isActive);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
      values.push(limit, offset);

      const { rows } = await db.query(query, values);
      return rows;
    } catch (error) {
      console.error('Error fetching all products:', error);
      throw error;
    }
  },

  /**
   * Updates an existing product.
   * @param {string} id - The UUID of the product to update.
   * @param {object} updates - An object containing the fields to update.
   * @returns {Promise<object|null>} The updated product object or null if not found.
   */
  async update(id, updates) {
    if (!id || Object.keys(updates).length === 0) {
      throw new Error('Product ID and at least one update field are required.');
    }

    const { name, description, image_url, unit_price, volume_price, stock, is_active } = updates;

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { setClauses.push(`name = $${paramIndex++}`); values.push(name); }
    if (description !== undefined) { setClauses.push(`description = $${paramIndex++}`); values.push(description); }
    if (image_url !== undefined) { setClauses.push(`image_url = $${paramIndex++}`); values.push(image_url); }
    if (unit_price !== undefined) { setClauses.push(`unit_price = $${paramIndex++}`); values.push(unit_price); }
    if (volume_price !== undefined) { setClauses.push(`volume_price = $${paramIndex++}`); values.push(volume_price); }
    if (stock !== undefined) { setClauses.push(`stock = $${paramIndex++}`); values.push(stock); }
    if (is_active !== undefined) { setClauses.push(`is_active = $${paramIndex++}`); values.push(is_active); }

    if (setClauses.length === 0) {
        throw new Error('No valid fields provided for update.');
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id); // For the WHERE clause

    try {
      const query = `
        UPDATE products
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *;
      `;
      const { rows } = await db.query(query, values);
      return rows[0] || null;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },

  /**
   * Updates the stock for a given product. Can be used to increase or decrease stock.
   * @param {string} productId - The UUID of the product.
   * @param {number} quantityChange - The amount to change the stock by (negative to decrease).
   * @param {object} [client] - Optional database client for transactions.
   * @returns {Promise<object>} The updated product with new stock.
   * @throws {Error} If product not found or insufficient stock for a decrease.
   */
  async updateStock(productId, quantityChange, client = db) {
    if (!productId || typeof quantityChange !== 'number') {
      throw new Error('Product ID and quantity change (number) are required.');
    }
    try {
      // Ensure stock doesn't go negative if quantityChange is negative
      const stockCheckQuery = 'SELECT stock FROM products WHERE id = $1 FOR UPDATE;'; // Lock row for update
      const { rows: productRows } = await client.query(stockCheckQuery, [productId]);
      if (productRows.length === 0) {
        throw new Error('Product not found for stock update.');
      }
      const currentStock = productRows[0].stock;
      if (currentStock + quantityChange < 0) {
        throw new Error(`Insufficient stock for product ID ${productId}. Available: ${currentStock}, Requested change: ${quantityChange}`);
      }

      const query = `
        UPDATE products
        SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, name, stock;
      `; // Only return necessary fields
      const values = [quantityChange, productId];
      const { rows } = await client.query(query, values);
      if (rows.length === 0) {
        // Should not happen if stockCheckQuery passed, but as a safeguard
        throw new Error('Product not found during stock update, or update failed.');
      }
      return rows[0];
    } catch (error) {
      console.error(`Error updating stock for product ${productId}:`, error);
      throw error;
    }
  },

  /**
   * Deletes a product (soft delete by marking as inactive).
   * @param {string} id - The UUID of the product to delete.
   * @returns {Promise<object|null>} The "deleted" (updated) product object or null if not found.
   */
  async delete(id) {
    if (!id) return null;
    try {
      const query = `
        UPDATE products
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;
      const { rows } = await db.query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error deleting product (soft delete):', error);
      throw error;
    }
  }
};

module.exports = ProductModel;
