import { AuthService } from "../services/auth.service.js";
import { UserRepository } from "../repositories/user.repository.js";
import { log } from "../utils/logger.js";

export async function register(req, res) {
  try {
    await AuthService.registerUser(req.body.username, req.body.password);
    res.json({ msg: "Usuario criado com sucesso" });
  } catch (error) {
    log.error("Auth", `Erro no registro: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

export async function login(req, res) {
  try {
    const { user, token } = await AuthService.authenticate(req.body.username, req.body.password);
    
    res.set("x-authorization", token);
    res.status(200).json({ 
      username: user.username, 
      token, 
      inbox_token: user.inbox_token 
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}

export async function status(req, res) {
  try {
    log.info("Auth", `Checando status do ID: ${req.userId}`);
    const user = await UserRepository.findById(req.userId);
    res.status(200).json(user);
  } catch (error) {
    log.error("Auth", "Erro ao recuperar status.");
    res.status(500).send();
  }
}