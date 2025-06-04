// mayoristapro/backend/src/models/orderItemModel.js
const db = require('../db');

const OrderItemModel = {
  /**
   * Creates a new order item (adds a product to an order).
   * This function will typically be called within a transaction in the OrderService.
   * @param {object} itemData - Data for the new order item.
   * @param {string} itemData.order_id - The UUID of the order.
   * @param {string} itemData.product_id - The UUID of the product.
   * @param {number} itemData.quantity - Quantity of the product.
   * @param {number} itemData.price_at_purchase - Price of the product at the time of purchase.
   * @param {string} itemData.supplier_id - The UUID of the supplier for this product.
   * @param {object} [client=db] - Optional database client for transactions.
   * @returns {Promise<object>} The created order item object.
   */
  async create(itemData, client = db) {
    const {
      order_id,
      product_id,
      quantity,
      price_at_purchase,
      supplier_id,
    } = itemData;

    if (!order_id || !product_id || !supplier_id || quantity === undefined || price_at_purchase === undefined) {
      throw new Error('Order ID, Product ID, Supplier ID, quantity, and price at purchase are required.');
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
        throw new Error('Quantity must be a positive number.');
    }

    try {
      const query = `
        INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase, supplier_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const values = [
        order_id,
        product_id,
        quantity,
        price_at_purchase,
        supplier_id,
      ];
      const { rows } = await client.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error creating order item:', error);
      // Handle foreign key violations specifically
      if (error.code === '23503') {
        if (error.constraint && error.constraint.includes('order_id')) {
          throw new Error('Order not found for this item.');
        } else if (error.constraint && error.constraint.includes('product_id')) {
          throw new Error('Product not found for this item.');
        } else if (error.constraint && error.constraint.includes('supplier_id')) {
          throw new Error('Supplier not found for this item.');
        }
      }
      throw error;
    }
  },

  /**
   * Finds all items associated with a specific order ID.
   * Includes product name and image for easier display.
   * @param {string} orderId - The UUID of the order.
   * @returns {Promise<Array<object>>} A list of order item objects with product details.
   */
  async findByOrderId(orderId) {
    if (!orderId) return [];
    try {
      const query = `
        SELECT
          oi.id,
          oi.order_id,
          oi.product_id,
          oi.quantity,
          oi.price_at_purchase,
          oi.supplier_id,
          p.name AS product_name,
          p.image_url AS product_image_url,
          s.name AS supplier_name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN suppliers s ON oi.supplier_id = s.id
        WHERE oi.order_id = $1
        ORDER BY oi.created_at ASC;
      `;
      const { rows } = await db.query(query, [orderId]);
      return rows;
    } catch (error) {
      console.error('Error finding order items by order ID:', error);
      throw error;
    }
  },

  /**
   * Calculates the total amount for a given order based on its items.
   * Useful for verification or if total_amount is not stored denormalized on the orders table.
   * @param {string} orderId - The UUID of the order.
   * @param {object} [client=db] - Optional database client for transactions.
   * @returns {Promise<number>} The sum of (quantity * price_at_purchase) for all items in the order.
   */
  async calculateOrderTotal(orderId, client = db) {
    if (!orderId) throw new Error('Order ID is required to calculate total.');
    try {
        const query = `
            SELECT SUM(quantity * price_at_purchase) as total
            FROM order_items
            WHERE order_id = $1;
        `;
        const { rows } = await client.query(query, [orderId]);
        return rows[0] && rows[0].total ? parseFloat(rows[0].total) : 0;
    } catch (error) {
        console.error('Error calculating order total from items:', error);
        throw error;
    }
  }

  // Update and Delete for order items are less common once an order is placed.
  // Typically, an order might be cancelled and recreated, or items handled
  // through returns/refunds processes, which are more complex.
  // For MVP, we'll focus on create and find.
};

module.exports = OrderItemModel;
