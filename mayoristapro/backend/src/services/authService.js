// mayoristapro/backend/src/services/authService.js
const UserModel = require('../models/userModel');
const SupplierModel = require('../models/supplierModel'); // For creating supplier record if role is 'proveedor'
const SupplierBalanceModel = require('../models/supplierBalanceModel'); // For initial balance
const DeliveryPersonModel = require('../models/deliveryPersonModel'); // For creating delivery person if role is 'repartidor'
const { generateToken } = require('../utils/jwtUtils');
const bcrypt = require('bcrypt');

const AuthService = {
  /**
   * Registers a new user and potentially a related entity (supplier, delivery person).
   * @param {object} userData - User data including email, password, role, and other role-specific data.
   * @param {string} userData.email
   * @param {string} userData.password
   * @param {string} userData.role - 'comprador', 'proveedor', 'repartidor', 'admin'
   * @param {string} [userData.name] - Required if role is 'proveedor' or 'repartidor' (for supplier name or delivery person name)
   * @param {string} [userData.supplierType] - Required if role is 'proveedor' (e.g., 'mayorista')
   * @param {string} [userData.phoneNumber] - Optional for 'repartidor'
   * @returns {Promise<object>} { token, user: { id, email, role } }
   * @throws {Error} If email already exists or for other validation/db errors.
   */
  async registerUser(userData) {
    const { email, password, role, name, supplierType, phoneNumber } = userData;

    if (!email || !password || !role) {
      throw new Error('Email, password, and role are required.');
    }

    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already in use.');
    }

    // Create the user in the users table
    // The UserModel.create hashes the password
    const newUser = await UserModel.create(email, password, role);
    if (!newUser) {
        throw new Error('User creation failed.');
    }

    // Handle role-specific entity creation
    try {
      if (role === 'proveedor') {
        if (!name || !supplierType) {
          // Attempt to rollback user creation or mark as incomplete setup
          // For now, we'll throw, expecting controller to handle potential cleanup or error reporting.
          // await UserModel.delete(newUser.id); // This would be complex if userModel doesn't have delete
          throw new Error('Supplier name and type are required for proveedor role.');
        }
        const newSupplier = await SupplierModel.create(newUser.id, name, supplierType);
        if (!newSupplier) {
            throw new Error('Supplier entity creation failed.');
        }
        // Create initial balance for the new supplier
        await SupplierBalanceModel.create(newSupplier.id, 0.00);

      } else if (role === 'repartidor') {
        if (!name) {
          // await UserModel.delete(newUser.id);
          throw new Error('Delivery person name is required for repartidor role.');
        }
        await DeliveryPersonModel.create({ user_id: newUser.id, name, phone_number: phoneNumber });
      }
      // 'comprador' or 'admin' roles don't need additional entities created here by default.
    } catch (entityError) {
        // If entity creation (supplier, delivery_person) fails after user is created,
        // this is a partial failure. Ideally, this whole process should be a transaction.
        // For MVP, we'll log and re-throw. A more robust solution would involve cleanup.
        console.error(`Error creating associated entity for user ${newUser.id} with role ${role}: ${entityError.message}`);
        // Potentially: await UserModel.hardDeleteById(newUser.id); // If user shouldn't exist without entity
        throw entityError; // Re-throw the error from entity creation
    }


    const tokenPayload = { id: newUser.id, role: newUser.role };
    const token = generateToken(tokenPayload);

    return {
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
    };
  },

  /**
   * Logs in a user.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} { token, user: { id, email, role } }
   * @throws {Error} If invalid credentials or user not found/inactive.
   */
  async loginUser(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const user = await UserModel.findByEmail(email); // findByEmail should return password_hash
    if (!user) {
      throw new Error('Invalid credentials. User not found.');
    }

    if (!user.is_active) {
        throw new Error('Account is inactive. Please contact support.');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid credentials. Password mismatch.');
    }

    const tokenPayload = { id: user.id, role: user.role };
    const token = generateToken(tokenPayload);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  },

  /**
   * Gets the profile of the currently authenticated user.
   * @param {string} userId - The ID of the user (from JWT).
   * @returns {Promise<object>} User profile object.
   * @throws {Error} If user not found.
   */
  async getMe(userId) {
    const user = await UserModel.findById(userId); // findById should exclude password_hash
    if (!user) {
      throw new Error('User not found.');
    }
    return user; // Contains id, email, role, is_active, created_at, updated_at
  },
};

module.exports = AuthService;
