// mayoristapro/backend/src/models/billingTransactionModel.js
const db = require('../db');

const BillingTransactionModel = {
  /**
   * Creates a new billing transaction record.
   * This should be called whenever a supplier's balance is affected by a chargeable event or a recharge.
   * @param {object} transactionData - Data for the new transaction.
   * @param {string} transactionData.supplier_id - The UUID of the supplier.
   * @param {string} transactionData.type - Type of transaction (e.g., 'publication_fee', 'recharge').
   * @param {number} transactionData.amount - The amount of the transaction.
   *                                          Positive for recharges, negative for fees/deductions.
   * @param {string} [transactionData.description] - Optional description for the transaction.
   * @param {object} [client=db] - Optional database client for transactions.
   * @returns {Promise<object>} The created billing transaction object.
   */
  async create(transactionData, client = db) {
    const {
      supplier_id,
      type,
      amount,
      description,
    } = transactionData;

    if (!supplier_id || !type || amount === undefined) {
      throw new Error('Supplier ID, type, and amount are required for a billing transaction.');
    }
    if (typeof amount !== 'number') {
        throw new Error('Transaction amount must be a number.');
    }

    try {
      const query = `
        INSERT INTO billing_transactions (supplier_id, type, amount, description)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;
      const values = [supplier_id, type, amount, description];
      const { rows } = await client.query(query, values);
      return rows[0];
    } catch (error) {
      console.error('Error creating billing transaction:', error);
      if (error.code === '23503') { // Foreign key violation for supplier_id
          throw new Error('Supplier not found for this billing transaction.');
      }
      throw error;
    }
  },

  /**
   * Finds all billing transactions for a specific supplier.
   * Supports pagination.
   * @param {string} supplierId - The UUID of the supplier.
   * @param {number} [limit=20] - Number of transactions to return.
   * @param {number} [offset=0] - Number of transactions to skip.
   * @returns {Promise<Array<object>>} A list of billing transaction objects.
   */
  async findBySupplierId(supplierId, limit = 20, offset = 0) {
    if (!supplierId) return [];
    try {
      const query = `
        SELECT * FROM billing_transactions
        WHERE supplier_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3;
      `;
      const { rows } = await db.query(query, [supplierId, limit, offset]);
      return rows;
    } catch (error)
 {
      console.error('Error finding billing transactions by supplier ID:', error);
      throw error;
    }
  },

  /**
   * Lists all billing transactions (primarily for admin purposes).
   * Supports filtering by type and pagination.
   * @param {object} [filters={}] - Optional filters.
   * @param {string} [filters.type] - Filter by transaction type.
   * @param {number} [limit=20] - Number of transactions to return.
   * @param {number} [offset=0] - Number of transactions to skip.
   * @returns {Promise<Array<object>>} A list of billing transaction objects.
   */
  async findAll({ type } = {}, limit = 20, offset = 0) {
    try {
      let query = 'SELECT bt.*, s.name as supplier_name FROM billing_transactions bt JOIN suppliers s ON bt.supplier_id = s.id';
      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (type) {
        conditions.push(`bt.type = $${paramIndex++}`);
        values.push(type);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY bt.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++};`;
      values.push(limit, offset);

      const { rows } = await db.query(query, values);
      return rows;
    } catch (error) {
      console.error('Error fetching all billing transactions:', error);
      throw error;
    }
  }
};

module.exports = BillingTransactionModel;
