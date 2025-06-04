// mayoristapro/backend/src/models/deliveryPersonModel.js
const db = require('../db');

const DeliveryPersonModel = {
  /**
   * Creates a new delivery person.
   * @param {object} data - Data for the new delivery person.
   * @param {string} data.user_id - The UUID of the associated user.
   * @param {string} data.name - Name of the delivery person.
   * @param {string} [data.phone_number] - Phone number.
   * @returns {Promise<object>} The created delivery person object.
   */
  async create({ user_id, name, phone_number }) {
    if (!user_id || !name) {
      throw new Error('User ID and name are required for creating a delivery person.');
    }
    try {
      const query = `
        INSERT INTO delivery_persons (user_id, name, phone_number, is_available)
        VALUES ($1, $2, $3, TRUE)
        RETURNING *;
      `;
      const values = [user_id, name, phone_number];
      const { rows } = await db.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error creating delivery person:', error);
      if (error.code === '23503') { // Foreign key violation for user_id
          throw new Error('Associated user not found for this delivery person.');
      }
      if (error.code === '23505') { // Unique constraint violation (e.g. user_id)
          throw new Error('This user is already registered as a delivery person or other unique constraint violated.');
      }
      throw error;
    }
  },

  /**
   * Finds a delivery person by their ID.
   * @param {string} id - The UUID of the delivery person.
   * @returns {Promise<object|null>} The delivery person object if found, otherwise null.
   */
  async findById(id) {
    if (!id) return null;
    try {
      const query = 'SELECT * FROM delivery_persons WHERE id = $1;';
      const { rows } = await db.query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding delivery person by ID:', error);
      throw error;
    }
  },

  /**
   * Finds a delivery person by their associated user ID.
   * @param {string} userId - The UUID of the user.
   * @returns {Promise<object|null>} The delivery person object if found, otherwise null.
   */
  async findByUserId(userId) {
    if (!userId) return null;
    try {
      const query = 'SELECT * FROM delivery_persons WHERE user_id = $1;';
      const { rows } = await db.query(query, [userId]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding delivery person by user ID:', error);
      throw error;
    }
  },

  /**
   * Updates a delivery person's details.
   * @param {string} id - The UUID of the delivery person.
   * @param {object} updates - Fields to update (e.g., { name, phone_number, is_available }).
   * @returns {Promise<object|null>} The updated delivery person object or null if not found.
   */
  async update(id, { name, phone_number, is_available }) {
    if (!id) throw new Error('Delivery Person ID is required for update.');

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { setClauses.push(`name = $${paramIndex++}`); values.push(name); }
    if (phone_number !== undefined) { setClauses.push(`phone_number = $${paramIndex++}`); values.push(phone_number); }
    if (is_available !== undefined) { setClauses.push(`is_available = $${paramIndex++}`); values.push(is_available); }

    if (setClauses.length === 0) {
        return this.findById(id); // No actual updates provided
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id); // For the WHERE clause

    try {
      const query = `
        UPDATE delivery_persons
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *;
      `;
      const { rows } = await db.query(query, values);
      return rows[0] || null;
    } catch (error) {
      console.error('Error updating delivery person:', error);
      throw error;
    }
  },

  /**
   * Updates the current location of a delivery person.
   * @param {string} id - The UUID of the delivery person.
   * @param {number} latitude - Current latitude.
   * @param {number} longitude - Current longitude.
   * @returns {Promise<object|null>} The updated delivery person object with new location.
   */
  async updateLocation(id, latitude, longitude) {
    if (!id || latitude === undefined || longitude === undefined) {
      throw new Error('Delivery Person ID, latitude, and longitude are required.');
    }
    try {
      const query = `
        UPDATE delivery_persons
        SET current_latitude = $1, current_longitude = $2, last_location_update = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING id, name, current_latitude, current_longitude, last_location_update;
      `;
      const values = [latitude, longitude, id];
      const { rows } = await db.query(query, values);
      return rows[0] || null;
    } catch (error) {
      console.error('Error updating delivery person location:', error);
      throw error;
    }
  },

  /**
   * Lists all delivery persons, optionally filtering by availability.
   * @param {object} [filters] - Optional filters.
   * @param {boolean} [filters.is_available] - Filter by availability.
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<Array<object>>} A list of delivery person objects.
   */
  async findAll({ is_available } = {}, limit = 20, offset = 0) {
    try {
      let query = 'SELECT dp.id, dp.user_id, dp.name, dp.phone_number, dp.is_available, u.email as user_email, dp.current_latitude, dp.current_longitude, dp.last_location_update FROM delivery_persons dp JOIN users u ON dp.user_id = u.id';
      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (is_available !== undefined) {
        conditions.push(`dp.is_available = $${paramIndex++}`);
        values.push(is_available);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY dp.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
      values.push(limit, offset);

      const { rows } = await db.query(query, values);
      return rows;
    } catch (error) {
      console.error('Error fetching all delivery persons:', error);
      throw error;
    }
  }
};

module.exports = DeliveryPersonModel;
