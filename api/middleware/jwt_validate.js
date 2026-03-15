import jwt from 'jsonwebtoken';
import { log } from '../utils/logger.js';
import { User } from '../models/models.js'; // Importe o model de Usuário

export async function middlewareValidarJWT(req, res, next) {
  const token = req.headers['x-authorization'];

  if (!token) {
    log.error("Auth", "Acesso negado: Token não fornecido");
    return res.status(401).json({ auth: false, message: 'Token não fornecido' });
  }

  // Use async/await ou busque o usuário dentro do callback
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      log.error("Auth", "Token inválido ou expirado");
      return res.status(401).json({ auth: false, message: 'Token inválido' });
    }
    
    // CORREÇÃO: Buscar o usuário para injetar no req
    try {
      const user = await User.findByPk(decoded.id);
      if (!user) return res.status(401).json({ error: "Usuário não encontrado" });

      req.user = {
        userId: user.id,
        inbox_token: user.inbox_token
      }; // Agora req.user.inbox_token funcionará no controller
      next();
    } catch (dbError) {
      return res.status(500).json({ error: "Erro interno ao validar usuário" });
    }
  });
}