// importa express
import { Router } from "express";
import { middlewareValidarJWT } from "../middleware/jwt_validate.js";

// cria router
const router = Router();

// controller
import {
  sendMessage,
  openedMessage,
} from "../controllers/messages.controller.js";

// enviar mensagem
router.post("/send", middlewareValidarJWT, sendMessage);

// MARCA COMO ABERTA
router.post("/opened", middlewareValidarJWT, openedMessage);

// exporta router
export default router;
