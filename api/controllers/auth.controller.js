// importa jsonwebtoken para gerar token
import "dotenv/config";
import jwt from "jsonwebtoken";
import { User } from "../models/models.js";
import bcrypt from "bcrypt";
import { getKeys } from "../generate_keys.js";

const { sign } = jwt;

/// registra usuário
export async function register(req, res) {
  // Checa se já existe no banco

  try {
    const { publicKey, privateKey } = await getKeys();
    const saltRounds = 10;

    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
    console.log("Hashed Password:", hashedPassword);
    // Store the 'hashedPassword' in your database

    const newUser = await User.create({
      username: req.body.username,
      password: hashedPassword,
      public_key: publicKey,
      private_key: privateKey,
    });
    // console.log(jane); // Don't do this
    console.log(newUser.toJSON()); // This is good!
    console.log(JSON.stringify(newUser, null, 4));
    newUser.save();
    res.json({ msg: "Usuario criado com sucesso" });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      res.status(500).json({ error: "User already exists." });
    } else {
      res.status(500).json({ msg: error.name });
    }
    console.log(error, error.parent.errno, error.parent.code, error.fields);
  }
}

// login
export async function login(req, res) {
  try {
    const checkUser = await User.findOne({
      where: { username: req.body.username },
    });
    if (!checkUser) {
      res.status(404).json({ error: "Credentials not found." });
    } else {
      const match = await bcrypt.compare(req.body.password, checkUser.password);

      if (match) {
        console.log("Password is correct! Login successful.");
        console.log("1", checkUser.dataValues.id);
        const token = sign(
          { id: checkUser.dataValues.id },
          process.env.JWT_SECRET,
          { expiresIn: "7d" },
          // Define para salvar em req.user
        );
        res.set("x-authorization", token);
        req.userInfo = checkUser.id;
        res.json({ username: checkUser.username, token, inbox_token: checkUser.inbox_token});
      } else {
        res
          .status(500)
          .json({ error: "Invalid credentials. Passwords do not match." });
        // Deny access
      }
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// users, testar o jwt
export async function users(req, res) {
  try {
    let data = {};
    const users = await User.findAll({});
    if (!users) {
      res.status(404).json({ error: "User not found" });
    } else {
      for (var i in users) {
        console.log(i + ":" + users[i].id, users[i].username);
        const toPush = {
          id: i,
          userId: users[i].id,
          username: users[i].username,
        };
        data["item_" + (i + 1)] = toPush;
      }
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function status(req, res) {
  try {
        const checkUser = await User.findOne({
      where: { id: req.userId },
    });
      res.json({
    username: checkUser.username,
    public_key : checkUser.public_key,
    settings : checkUser.settings,
    role: checkUser.role

  });
  } catch (error) {

}
}

// const users = await User.findAll({});

// console.log(users);
