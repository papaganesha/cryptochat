import { AuthService } from "../services/auth.service.js";
import { UserRepository } from "../repositories/user.repository.js";
import { log } from "../utils/logger.js";

export async function register(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Dados incompletos." });

    const user = await AuthService.registerUser(username, password);
    console.log(user)
    res.status(201).json({ message: "Usuário registrado com sucesso.",
  token, 
  user: {
    username: user.username, 
    inbox_token: user.inbox_token 
  } });
  } catch (error) {
    log.error("Auth", `Erro no registro: ${error.message}`);
    res.status(400).json({ error: error.message });
  }
}

export async function login(req, res) {
  try {
    const { username, password } = req.body;
    const { user, token } = await AuthService.authenticate(username, password);
    
    res.set("x-authorization", token);
    res.status(200).json({ 
auth: true,
  token, 
  user: {
    username: user.username, 
    inbox_token: user.inbox_token 
  }
});
  } catch (error) {
    // 💡 Senior Tip: 401 é o status correto para falha de login
    res.status(401).json({ error: error.message });
  }
}

export async function status(req, res) {
  try {
    const user = await UserRepository.findById(req.userId);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
    
    res.status(200).json(user);
  } catch (error) {
    log.error("Auth", "Erro ao recuperar status.");
    res.status(500).json({ error: "Erro interno no servidor." });
  }
}