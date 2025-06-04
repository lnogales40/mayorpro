// mayoristapro/backend/src/models/userModel.js
const db = require('../db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10; // For bcrypt password hashing

const UserModel = {
  /**
   * Creates a new user in the database.
   * Hashes the password before storing.
   * @param {string} email - User's email.
   * @param {string} password - User's plain text password.
   * @param {string} role - User's role (e.g., 'comprador', 'proveedor').
   * @returns {Promise<object>} The created user object (without password_hash).
   * @throws {Error} If there's an error during database operation or password hashing.
   */
  async create(email, password, role = 'comprador') {
    if (!email || !password || !role) {
      throw new Error('Email, password, and role are required for creating a user.');
    }
    try {
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const query = `
        INSERT INTO users (email, password_hash, role)
        VALUES ($1, $2, $3)
        RETURNING id, email, role, is_active, created_at, updated_at;
      `;
      const values = [email, hashedPassword, role];
      const { rows } = await db.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error; // Re-throw to be handled by service/controller
    }
  },

  /**
   * Finds a user by their email.
   * @param {string} email - The email to search for.
   * @returns {Promise<object|null>} The user object if found (including password_hash), otherwise null.
   */
  async findByEmail(email) {
    if (!email) return null;
    try {
      const query = 'SELECT * FROM users WHERE email = $1;';
      const { rows } = await db.query(query, [email]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  },

  /**
   * Finds a user by their ID.
   * @param {string} id - The UUID of the user to search for.
   * @returns {Promise<object|null>} The user object if found (excluding password_hash by default).
   */
  async findById(id) {
    if (!id) return null;
    try {
      const query = 'SELECT id, email, role, is_active, created_at, updated_at FROM users WHERE id = $1;';
      const { rows } = await db.query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  },

  /**
   * Updates a user's status (is_active).
   * @param {string} id - The UUID of the user.
   * @param {boolean} isActive - The new status.
   * @returns {Promise<object|null>} The updated user object or null if not found.
   */
  async updateStatus(id, isActive) {
    if (!id || typeof isActive !== 'boolean') {
        throw new Error('User ID and active status (boolean) are required.');
    }
    try {
        const query = `
            UPDATE users
            SET is_active = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, email, role, is_active, created_at, updated_at;
        `;
        const { rows } = await db.query(query, [isActive, id]);
        return rows[0] || null;
    } catch (error) {
        console.error('Error updating user status:', error);
        throw error;
    }
  },

  /**
   * Lists all users (primarily for admin purposes).
   * Supports basic pagination.
   * @param {number} limit - Number of users to return.
   * @param {number} offset - Number of users to skip.
   * @returns {Promise<Array<object>>} A list of user objects.
   */
  async findAll(limit = 20, offset = 0) {
    try {
        const query = `
            SELECT id, email, role, is_active, created_at, updated_at
            FROM users
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2;
        `;
        const { rows } = await db.query(query, [limit, offset]);
        return rows;
    } catch (error) {
        console.error('Error fetching all users:', error);
        throw error;
    }
  }
};

module.exports = UserModel;
