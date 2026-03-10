import { markMessageOpened, sendMessageToInbox } from "../messages.js";
import { User } from "../models/models.js";

export async function sendMessage(req, res) {
  try {
    const { toUsername, cypherText, nonce, ephemeral, time } = req.body;
    const receiver = await User.findOne({ where: { username: toUsername } });

    if (!receiver) return res.status(404).json({ error: "User not found" });

    const message = {
      cyphertext: cypherText, // Use minúsculo para bater com o markMessageOpened
      nonce,
      ephemeral: ephemeral || false,
      time: time || 1,
      opened: false // Agora a variável está definida
    };

    await sendMessageToInbox(receiver.inbox_token, message);
    res.status(201).json({ status: "sent" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Adicione (req, res) aqui para evitar o crash de "req is undefined"
export async function openedMessage(req, res) { 
  try {
    const { inbox_token, message } = req.body;
    await markMessageOpened(inbox_token, message);
    res.status(200).json({ status: "opened" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
