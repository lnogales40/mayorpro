// mayoristapro/backend/src/models/supplierModel.js
const db = require('../db');

const SupplierModel = {
  /**
   * Creates a new supplier.
   * @param {string} userId - The UUID of the associated user.
   * @param {string} name - The name of the supplier.
   * @param {string} type - Type of supplier (e.g., 'mayorista', 'comerciante').
   * @returns {Promise<object>} The created supplier object.
   */
  async create(userId, name, type) {
    if (!userId || !name || !type) {
      throw new Error('User ID, name, and type are required for creating a supplier.');
    }
    try {
      const query = `
        INSERT INTO suppliers (user_id, name, type, status)
        VALUES ($1, $2, $3, 'pendiente_aprobacion')
        RETURNING id, user_id, name, type, status, created_at, updated_at;
      `;
      const values = [userId, name, type];
      const { rows } = await db.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error creating supplier:', error);
      // Consider more specific error handling, e.g., if user_id does not exist
      if (error.code === '23503') { // Foreign key violation
          throw new Error('Associated user not found.');
      }
      throw error;
    }
  },

  /**
   * Finds a supplier by their ID.
   * @param {string} id - The UUID of the supplier.
   * @returns {Promise<object|null>} The supplier object if found, otherwise null.
   */
  async findById(id) {
    if (!id) return null;
    try {
      const query = 'SELECT * FROM suppliers WHERE id = $1;';
      const { rows } = await db.query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding supplier by ID:', error);
      throw error;
    }
  },

  /**
   * Finds a supplier by their associated user ID.
   * @param {string} userId - The UUID of the user.
   * @returns {Promise<object|null>} The supplier object if found, otherwise null.
   */
  async findByUserId(userId) {
    if (!userId) return null;
    try {
      const query = 'SELECT * FROM suppliers WHERE user_id = $1;';
      const { rows } = await db.query(query, [userId]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding supplier by user ID:', error);
      throw error;
    }
  },

  /**
   * Updates the status of a supplier.
   * @param {string} id - The UUID of the supplier.
   * @param {string} status - The new status (e.g., 'aprobado', 'rechazado', 'activo', 'inactivo').
   * @returns {Promise<object|null>} The updated supplier object or null if not found.
   */
  async updateStatus(id, status) {
    if (!id || !status) {
      throw new Error('Supplier ID and status are required for updating status.');
    }
    // Basic validation for allowed statuses could be added here
    const allowedStatuses = ['pendiente_aprobacion', 'aprobado', 'rechazado', 'activo', 'inactivo'];
    if (!allowedStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}. Allowed statuses are: ${allowedStatuses.join(', ')}`);
    }
    try {
      const query = `
        UPDATE suppliers
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, user_id, name, type, status, created_at, updated_at;
      `;
      const { rows } = await db.query(query, [status, id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error updating supplier status:', error);
      throw error;
    }
  },

  /**
   * Lists all suppliers (primarily for admin purposes).
   * Supports filtering by status and type, and basic pagination.
   * @param {object} filters - Optional filters (e.g., { status, type }).
   * @param {number} limit - Number of suppliers to return.
   * @param {number} offset - Number of suppliers to skip.
   * @returns {Promise<Array<object>>} A list of supplier objects.
   */
  async findAll({ status, type } = {}, limit = 20, offset = 0) {
    try {
      let query = 'SELECT s.id, s.user_id, s.name, s.type, s.status, u.email as user_email, s.created_at, s.updated_at FROM suppliers s JOIN users u ON s.user_id = u.id';
      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (status) {
        conditions.push(`s.status = $${paramIndex++}`);
        values.push(status);
      }
      if (type) {
        conditions.push(`s.type = $${paramIndex++}`);
        values.push(type);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY s.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
      values.push(limit, offset);

      const { rows } = await db.query(query, values);
      return rows;
    } catch (error) {
      console.error('Error fetching all suppliers:', error);
      throw error;
    }
  }
};

module.exports = SupplierModel;
