import { User } from "../models/models.js";

export const UserRepository = {
  // Busca por nome de usuário (Login)
  async findByUsername(username) {
    return await User.findOne({ where: { username } });
  },

  // Busca por ID (Status/Profile)
  async findById(id) {
    return await User.findByPk(id, {
      attributes: ['username', 'public_key', 'settings', 'role', 'inbox_token']
    });
  },

  // Criação de novo usuário (Register)
  async create(userData) {
    return await User.create(userData);
  }
};