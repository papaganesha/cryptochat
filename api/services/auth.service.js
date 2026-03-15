import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { UserRepository } from "../repositories/user.repository.js";
import { getKeys } from "../generate_keys.js";
import { log } from "../utils/logger.js";

// Senha falsa para evitar Timing Attacks quando o user não existe
const DUMMY_HASH = "$2b$10$vI8vKEW.I0p84Y6D.H7S9eM5G1VvH.8vKEW.I0p84Y6D.H7S9eM";

export const AuthService = {
  async registerUser(username, password) {
    // 💡 Senior Tip: Validar se o usuário já existe antes de gerar chaves (economiza CPU)
    const exists = await UserRepository.findByUsername(username);
    if (exists) throw new Error("Este nome de usuário já está em uso.");

    const { publicKey, privateKey } = await getKeys();
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await UserRepository.create({
      username,
      password: hashedPassword,
      public_key: publicKey,
      private_key: privateKey,
    });

    log.success("Auth", `Usuário criado: ${newUser.username}`);
    return newUser;
  },

  async authenticate(username, password) {
    const user = await UserRepository.findByUsername(username);

    // Se o usuário não existe, comparamos a senha com o DUMMY_HASH
    // Isso faz o tempo de resposta ser igual ao de um usuário que existe
    const isValid = await bcrypt.compare(password, user?.password || DUMMY_HASH);

    if (!user || !isValid) {
      log.error("Auth", `Falha de login para o usuário: ${username}`);
      // 🛡️ NUNCA diga se foi o usuário ou a senha que errou
      throw new Error("Credenciais inválidas."); 
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return { user, token };
  }
};