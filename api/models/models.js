import { DataTypes } from "sequelize";
import { sequelize } from "../config/db_connect.js";

// --- MODELO: USER ---
// ID(UUIDV4 PRIMARY) --- USERNAME(STRING NOT NULL) --- PASSWORD(STRING NOT  NULL) --- PBKEY(TEXT NOT NULL) --- PVKEY(TEXT NOT NULL), ROLE(ENUM )
// SETTINGS(JSON => THEME(STRING DEFAUL LIGHT) AND NOTIFICATIONS(BOOLEAN DEFAULT TRUE))
const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    public_key: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    private_key: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    role: {
      type: DataTypes.ENUM("admin", "user", "guest"),
      defaultValue: "user",
      allowNull: false,
    },
    inbox_token: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      unique: true,
    },
    settings: {
      type: DataTypes.JSON,
      defaultValue: {
        theme: "light",
        notifications: true,
      },
    },
  },
  {
    // Other model options go here
    protectedAttributes: ["password"],
    toJSON() {
      const values = Object.assign({}, this.get());
      delete values.password; // Garante que a senha nunca vá para o frontend
      return values;
    },
  },
);

// --- MODELO: MESSAGE ---
// ID(UUIDV4 PRIMARY) --- CYPHERTEXT(TEXT NOT NULL) --- NONCE(STRING NOT  NULL) --- EPHEMERAL(BOOLEAN(0 => TTL 1 => EFEMEROUS)) NOT NULL --- TIME(TTL OR EFEMEROUS) NOT NULL
// OPENED(BOOLEAN) DEFAULT FALSE
const Message = sequelize.define("Message", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ciphertext: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  nonce: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ephemeral: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  time: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  opened: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

export { User, Message, sequelize };
