import { User } from "../models/models.js";
import { MessageService } from "../services/messages.service.js";
import { log } from "../utils/logger.js";

export async function sendMessage(req, res) {
  const { toUsername, cypherText, ephemeral, time } = req.body;

  try {
    const receiver = await User.findOne({ where: { username: toUsername } });
    
    // O teste espera 404 aqui. Se não houver este IF, o código abaixo explode em 500.
    if (!receiver) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const message = {
      cyphertext: cypherText, // Note o 'cyphertext' minúsculo conforme seu Service
      ephemeral: ephemeral || false,
      time: time || 1,
      sender: req.userId 
    };

    await MessageService.send(receiver, message);
    res.status(201).json({ status: "sent" });

  } catch (error) {
    log.error("❌ ERRO NO SEND_MESSAGE:", error); // Isso vai aparecer no seu terminal
//     res.status(403).json({ error: error.message });
  }
}
export async function openedMessage(req, res) {
  const { inbox_token, message } = req.body;
  // SEGURANÇA: O req.user vem do seu middleware de JWT
  // Se o token enviado no corpo não for igual ao token do dono do JWT, bloqueia!
  if (req.user.inbox_token !== inbox_token) {
    return res.status(403).json({ error: "Acesso negado à inbox alheia." });
  }
  try {
    const success = await MessageService.open(inbox_token, message);
    if (success) {
      res.status(200).json({ status: "processed" });
    } else {
      res.status(403).json({ error: "Mensagem não encontrada no Redis" });
    }
  } catch (error) {
log.error("❌ ERRO NO OPENED_MESSAGE:", error);
    res.status(403).json({ error: error.message });
  }
}