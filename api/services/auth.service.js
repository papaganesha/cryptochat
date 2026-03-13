import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { UserRepository } from "../repositories/user.repository.js";
import { getKeys } from "../generate_keys.js";
import { log } from "../utils/logger.js";

export const AuthService = {
  // Lógica de Registro
  async registerUser(username, password) {
    const { publicKey, privateKey } = await getKeys();
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    log.info("Auth", "Senha processada com hash.");

    const newUser = await UserRepository.create({
      username,
      password: hashedPassword,
      public_key: publicKey,
      private_key: privateKey,
    });

    log.success("Auth", `Usuário criado: ${newUser.username}`);
    return newUser;
  },

  // Lógica de Login
  async authenticate(username, password) {
    const user = await UserRepository.findByUsername(username);

    if (!user) {
      log.error("Auth", "Usuário não encontrado.");
      throw new Error("Credentials not found.");
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      log.error("Auth", "Senha incorreta.");
      throw new Error("Invalid credentials.");
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    log.success("Auth", `Login realizado: ${user.username}`);
    log.info("JWT", `Token gerado para ID: ${user.id}`);

    return { user, token };
  }
};