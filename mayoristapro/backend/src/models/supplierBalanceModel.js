// mayoristapro/backend/src/models/supplierBalanceModel.js
const db = require('../db');

const SupplierBalanceModel = {
  /**
   * Creates an initial balance record for a new supplier.
   * Typically called when a supplier is approved or created.
   * @param {string} supplierId - The UUID of the supplier.
   * @param {number} [initialBalance=0.00] - The initial balance.
   * @param {object} [client=db] - Optional database client for transactions.
   * @returns {Promise<object>} The created supplier balance object.
   */
  async create(supplierId, initialBalance = 0.00, client = db) {
    if (!supplierId) {
      throw new Error('Supplier ID is required to create a balance record.');
    }
    try {
      const query = `
        INSERT INTO supplier_balances (supplier_id, balance)
        VALUES ($1, $2)
        ON CONFLICT (supplier_id) DO NOTHING
        RETURNING *;
        -- ON CONFLICT DO NOTHING ensures this doesn't error if called multiple times,
        -- though ideally it's called once.
        -- If it already exists, it returns nothing from RETURNING.
        -- Consider a separate check if specific behavior on conflict is needed.
      `;
      const values = [supplierId, initialBalance];
      const { rows } = await client.query(query, values);
      if (rows.length > 0) {
        return rows[0];
      }
      // If ON CONFLICT DO NOTHING occurred, the row might already exist. Fetch it.
      return this.findBySupplierId(supplierId, client);
    } catch (error) {
      console.error('Error creating supplier balance:', error);
      if (error.code === '23503') { // Foreign key violation for supplier_id
          throw new Error('Supplier not found for this balance record.');
      }
      throw error;
    }
  },

  /**
   * Finds the balance for a specific supplier.
   * @param {string} supplierId - The UUID of the supplier.
   * @param {object} [client=db] - Optional database client for transactions.
   * @returns {Promise<object|null>} The supplier balance object if found, otherwise null.
   */
  async findBySupplierId(supplierId, client = db) {
    if (!supplierId) return null;
    try {
      const query = 'SELECT * FROM supplier_balances WHERE supplier_id = $1;';
      const { rows } = await client.query(query, [supplierId]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding supplier balance by supplier ID:', error);
      throw error;
    }
  },

  /**
   * Updates the balance for a supplier.
   * This function adds the `amountChange` to the current balance.
   * Use a negative `amountChange` to decrease the balance.
   * IMPORTANT: Ensure this is called within a transaction if the balance update
   * is part of a larger operation (e.g., deducting publication fees).
   * @param {string} supplierId - The UUID of the supplier.
   * @param {number} amountChange - The amount to add to/subtract from the balance.
   * @param {object} [client=db] - Optional database client for transactions.
   * @returns {Promise<object|null>} The updated supplier balance object or null if not found.
   * @throws {Error} If the update would result in a negative balance and this is not allowed.
   */
  async updateBalance(supplierId, amountChange, client = db) {
    if (!supplierId || typeof amountChange !== 'number') {
      throw new Error('Supplier ID and a numeric amount change are required.');
    }

    // Optional: Check if balance would go negative if that's a constraint
    // For now, we allow it, but this is where such logic would go.
    // const currentBalance = await this.findBySupplierId(supplierId, client);
    // if (currentBalance && (currentBalance.balance + amountChange < 0)) {
    //   throw new Error('Insufficient balance for this operation.');
    // }

    try {
      const query = `
        UPDATE supplier_balances
        SET balance = balance + $1, last_update = CURRENT_TIMESTAMP
        WHERE supplier_id = $2
        RETURNING *;
      `;
      const values = [amountChange, supplierId];
      const { rows } = await client.query(query, values);
      if (rows.length === 0) {
        // This case implies the supplier_id does not exist in supplier_balances,
        // which might indicate an issue (e.g., supplier created without a balance entry).
        // For robustness, one might choose to create it here or throw a more specific error.
        console.warn(`No balance record found for supplier ${supplierId} during update. Creating one.`);
        return this.create(supplierId, amountChange, client); // Create with the amountChange as initial if it's a recharge
      }
      return rows[0];
    } catch (error) {
      console.error('Error updating supplier balance:', error);
      throw error;
    }
  }
};

module.exports = SupplierBalanceModel;
