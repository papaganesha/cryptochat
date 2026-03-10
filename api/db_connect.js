import Sequelize from "sequelize";

// Option 3: Passing parameters separately (other dialects)
const sequelize = new Sequelize(
  "database_development",
  "postgres",
  "admin123",
  {
    host: "localhost",
    dialect: "postgres",
    //logging: console.log, // <--- Force logging to the console
    logging: false
  },
);

// função que aguarda conexão com o banco
async function waitForDB() {
  // variável de controle
  let connected = false;

  // loop até conectar
  while (!connected) {
    try {
      // testa conexão simples
      await sequelize.authenticate();

      // se funcionar, banco está online
      connected = true;
    } catch {
      // se der erro, provavelmente é porque o banco ainda não está pronto
      console.log("⏳ Banco de dados ainda não disponível. Tentando novamente em 2 segundos...");
      // espera 2 segundos
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export { sequelize, waitForDB };
