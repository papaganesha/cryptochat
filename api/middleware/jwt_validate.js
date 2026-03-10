import 'dotenv/config'; 
import jwt from 'jsonwebtoken';



export async function middlewareValidarJWT (req, res, next){

  const token = req.headers['x-authorization']; 
  console.log("1", token)

  if (!token) return res.status(401).json({ auth: false, message: 'Token não fornecido' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ auth: false, message: 'Token inválido' });

    // Se válido, salva o ID do usuário no request para usar nas próximas rotas
    console.log("2..", decoded.id)
    req.userId = decoded.id;
    next();
  });
};// No middleware


