import Sequelize from "sequelize";

// Configura o Sequelize com os dados do Postgres
const sequelize = new Sequelize(
  process.env.DB_NAME || "database_development",
  process.env.DB_USER || "postgres",
  process.env.DB_PASS || "admin123",
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "postgres",
    logging: false // Desativa logs chatos de SQL no terminal
  },
);

// Função que garante que o banco esteja online antes do App subir
async function waitForDB() {
  const maxRetries = 15; // Tenta por uns 30 segundos no total
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // Define um timeout interno para o Sequelize não esperar para sempre
      await sequelize.authenticate({ timeout: 5000 }); 
      console.log("✅ Postgres: Conexão estabelecida.");
      return; // Sai da função com sucesso
    } catch (err) {
      retries++;
      console.log(`⏳ Postgres: Tentativa ${retries}/${maxRetries} falhou. Aguardando 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Se chegar aqui, o banco realmente não subiu
  throw new Error("🚨 Não foi possível conectar ao Postgres após várias tentativas.");
}

export { sequelize, waitForDB };