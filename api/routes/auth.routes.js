// importa express
import { Router } from "express"
import { middlewareValidarJWT } from "../middleware/jwt_validate.js"

// cria router
const router = Router()

// importa controller
import { register, login, users, status } from "../controllers/auth.controller.js"

// rota registro
router.post("/register",register)

// rota login
router.post("/login",login)

// rota testejwt
router.post("/users",middlewareValidarJWT ,users)

// rota status token
router.get("/status",middlewareValidarJWT ,status)

// exporta router
export default router