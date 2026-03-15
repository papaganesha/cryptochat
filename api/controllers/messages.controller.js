import { User } from "../models/models.js";
import { MessageService } from "../services/messages.service.js";
import { log } from "../utils/logger.js";

export async function sendMessage(req, res) {
  const { toUsername, cypherText, ephemeral, time } = req.body;

  try {
    // Buscamos o receiver com atributos limitados (Performance)
    const receiver = await User.findOne({ 
      where: { username: toUsername },
      attributes: ['id', 'username', 'inbox_token'] 
    });
    
    if (!receiver) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Montagem do objeto de mensagem padronizado
    const message = {
      cyphertext: cypherText,
      ephemeral: !!ephemeral, // Garante que é booleano
      time: time || 0.0007,
      sender: req.userId 
    };

    await MessageService.send(receiver, message);
    
    return res.status(201).json({ status: "sent" });

  } catch (error) {
    log.error("Auth", `Erro no envio: ${error.message}`);
    return res.status(500).json({ error: "Falha interna no envio." });
  }
}

export async function openedMessage(req, res) {
  const { inbox_token, message } = req.body;

  // 🔐 Verificação de Segurança (Vem do req.user injetado pelo Middleware)
  if (!req.user || req.user.inbox_token !== inbox_token) {
    log.warn("Security", `Tentativa de acesso negado à inbox: ${inbox_token}`);
    return res.status(403).json({ error: "Acesso negado à inbox." });
  }

  try {
    const success = await MessageService.open(inbox_token, message);
    
    if (success) {
      return res.status(200).json({ status: "processed" });
    }
    
    return res.status(404).json({ error: "Mensagem não encontrada ou já expirou." });
  } catch (error) {
    log.error("Redis", `Erro ao abrir mensagem: ${error.message}`);
    return res.status(500).json({ error: "Erro ao processar leitura." });
  }
}