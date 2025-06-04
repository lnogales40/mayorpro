// mayoristapro/backend/src/models/orderModel.js
const db = require('../db');

const OrderModel = {
  /**
   * Creates a new order.
   * This function will typically be called within a transaction in the OrderService
   * to ensure atomicity when creating order items and updating stock.
   * @param {object} orderData - Data for the new order.
   * @param {string} orderData.user_id - The UUID of the user placing the order.
   * @param {number} orderData.total_amount - Total amount for the order (excluding shipping initially or pre-calculated).
   * @param {number} orderData.shipping_cost - Calculated shipping cost.
   * @param {string} orderData.delivery_address_street
   * @param {string} orderData.delivery_address_city
   * @param {string} orderData.delivery_address_state
   * @param {string} orderData.delivery_address_zip
   * @param {string} [orderData.status='pendiente'] - Initial status of the order.
   * @param {object} [client=db] - Optional database client for transactions.
   * @returns {Promise<object>} The created order object.
   */
  async create(orderData, client = db) {
    const {
      user_id,
      total_amount,
      shipping_cost,
      delivery_address_street,
      delivery_address_city,
      delivery_address_state,
      delivery_address_zip,
      status = 'pendiente',
    } = orderData;

    if (!user_id || total_amount === undefined || shipping_cost === undefined || !delivery_address_street || !delivery_address_city || !delivery_address_state || !delivery_address_zip) {
      throw new Error('User ID, total amount, shipping cost, and full delivery address are required.');
    }

    try {
      const query = `
        INSERT INTO orders (user_id, total_amount, shipping_cost, status,
                            delivery_address_street, delivery_address_city,
                            delivery_address_state, delivery_address_zip)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `;
      const values = [
        user_id,
        total_amount,
        shipping_cost,
        status,
        delivery_address_street,
        delivery_address_city,
        delivery_address_state,
        delivery_address_zip,
      ];
      const { rows } = await client.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error creating order:', error);
      if (error.code === '23503') { // Foreign key violation for user_id
          throw new Error('User not found for this order.');
      }
      throw error;
    }
  },

  /**
   * Finds an order by its ID, including associated items and product details.
   * @param {string} id - The UUID of the order.
   * @returns {Promise<object|null>} The order object with items if found, otherwise null.
   */
  async findByIdWithDetails(id) {
    if (!id) return null;
    try {
      const orderQuery = 'SELECT * FROM orders WHERE id = $1;';
      const orderResult = await db.query(orderQuery, [id]);
      if (orderResult.rows.length === 0) {
        return null;
      }
      const order = orderResult.rows[0];

      // Fetch associated order items and their product details
      const itemsQuery = `
        SELECT oi.id as order_item_id, oi.quantity, oi.price_at_purchase,
               p.id as product_id, p.name as product_name, p.image_url as product_image_url,
               s.id as supplier_id, s.name as supplier_name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN suppliers s ON oi.supplier_id = s.id
        WHERE oi.order_id = $1;
      `;
      const itemsResult = await db.query(itemsQuery, [id]);
      order.items = itemsResult.rows;

      // Optionally, fetch user details (e.g., email)
      const userQuery = 'SELECT email FROM users WHERE id = $1;';
      const userResult = await db.query(userQuery, [order.user_id]);
      if (userResult.rows.length > 0) {
        order.user_email = userResult.rows[0].email;
      }

      // Optionally, fetch delivery person details if assigned
      if (order.delivery_person_id) {
        const deliveryPersonQuery = 'SELECT name, phone_number FROM delivery_persons WHERE id = $1;';
        const dpResult = await db.query(deliveryPersonQuery, [order.delivery_person_id]);
        if (dpResult.rows.length > 0) {
          order.delivery_person_details = dpResult.rows[0];
        }
      }

      return order;
    } catch (error) {
      console.error('Error finding order by ID with details:', error);
      throw error;
    }
  },

  /**
   * Finds orders by user ID.
   * @param {string} userId - The UUID of the user.
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<Array<object>>} A list of order objects.
   */
  async findByUserId(userId, limit = 20, offset = 0) {
    if (!userId) return [];
    try {
      const query = `
        SELECT * FROM orders
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3;
      `;
      const { rows } = await db.query(query, [userId, limit, offset]);
      return rows;
    } catch (error) {
      console.error('Error finding orders by user ID:', error);
      throw error;
    }
  },

  /**
   * Finds orders relevant to a specific supplier.
   * This involves checking order_items for products belonging to the supplier.
   * @param {string} supplierId - The UUID of the supplier.
   * @param {object} [filters] - Optional filters like status.
   * @param {string} [filters.status] - Filter by order status.
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<Array<object>>} A list of order objects.
   */
  async findBySupplierId(supplierId, { status } = {}, limit = 20, offset = 0) {
    if (!supplierId) return [];
    try {
      const conditions = ['oi.supplier_id = $1'];
      const values = [supplierId];
      let paramIndex = 2;

      if (status) {
        conditions.push(`o.status = $${paramIndex++}`);
        values.push(status);
      }

      const query = `
        SELECT DISTINCT o.*
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY o.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++};
      `;
      values.push(limit, offset);

      const { rows } = await db.query(query, values);
      return rows;
    } catch (error) {
      console.error('Error finding orders by supplier ID:', error);
      throw error;
    }
  },

  /**
   * Finds orders by delivery person ID.
   * @param {string} deliveryPersonId - The UUID of the delivery person.
   * @param {object} [filters] - Optional filters like status.
   * @param {string} [filters.status] - Filter by order status.
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<Array<object>>} A list of order objects.
   */
  async findByDeliveryPersonId(deliveryPersonId, { status } = {}, limit = 20, offset = 0) {
    if (!deliveryPersonId) return [];
    try {
      const conditions = ['delivery_person_id = $1'];
      const values = [deliveryPersonId];
      let paramIndex = 2;

      if (status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      const query = `
        SELECT * FROM orders
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++};
      `;
      values.push(limit, offset);

      const { rows } = await db.query(query, values);
      return rows;
    } catch (error) {
      console.error('Error finding orders by delivery person ID:', error);
      throw error;
    }
  },

  /**
   * Lists all orders (primarily for admin purposes).
   * Supports filtering by status and basic pagination.
   * @param {object} filters - Optional filters (e.g., { status }).
   * @param {number} limit - Number of orders to return.
   * @param {number} offset - Number of orders to skip.
   * @returns {Promise<Array<object>>} A list of order objects.
   */
  async findAll({ status } = {}, limit = 20, offset = 0) {
    try {
      let query = 'SELECT o.*, u.email as user_email FROM orders o JOIN users u ON o.user_id = u.id';
      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (status) {
        conditions.push(`o.status = $${paramIndex++}`);
        values.push(status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
      values.push(limit, offset);

      const { rows } = await db.query(query, values);
      return rows;
    } catch (error) {
      console.error('Error fetching all orders:', error);
      throw error;
    }
  },

  /**
   * Updates the status of an order.
   * @param {string} id - The UUID of the order.
   * @param {string} status - The new status.
   * @returns {Promise<object|null>} The updated order object or null if not found.
   */
  async updateStatus(id, status) {
    if (!id || !status) {
      throw new Error('Order ID and status are required.');
    }
    // TODO: Add validation for allowed status transitions if needed
    const allowedStatuses = ['pendiente', 'confirmado', 'retirado', 'entregado', 'cancelado'];
     if (!allowedStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}. Allowed statuses are: ${allowedStatuses.join(', ')}\`);
    }
    try {
      const query = `
        UPDATE orders
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *;
      `;
      const { rows } = await db.query(query, [status, id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  },

  /**
   * Assigns a delivery person to an order and updates its status.
   * @param {string} orderId - The UUID of the order.
   * @param {string} deliveryPersonId - The UUID of the delivery person.
   * @param {string} [newStatus='retirado'] - The new status for the order, typically 'retirado'.
   * @returns {Promise<object|null>} The updated order object or null if not found.
   */
  async assignDeliveryPerson(orderId, deliveryPersonId, newStatus = 'retirado') {
    if (!orderId || !deliveryPersonId) {
      throw new Error('Order ID and Delivery Person ID are required.');
    }
    try {
      const query = `
        UPDATE orders
        SET delivery_person_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *;
      `;
      const { rows } = await db.query(query, [deliveryPersonId, newStatus, orderId]);
      if (rows.length === 0) return null;

      // Also update delivery person availability (example, actual logic might be more complex)
      // This might be better handled in a DeliveryPersonService
      // await db.query('UPDATE delivery_persons SET is_available = FALSE WHERE id = $1', [deliveryPersonId]);

      return rows[0];
    } catch (error) {
      console.error('Error assigning delivery person to order:', error);
      if (error.code === '23503') { // Foreign key violation
          throw new Error('Delivery person or order not found, or constraints violated.');
      }
      throw error;
    }
  }
};

module.exports = OrderModel;
