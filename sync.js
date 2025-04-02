const sequelize = require("./config/database");
const Agendamento = require("./models/Agendamento");

async function syncDatabase() {
  try {
    await sequelize.sync({ force: true }); // `force: true` recria a tabela
    console.log("Banco de dados sincronizado!");
  } catch (error) {
    console.error("Erro ao sincronizar o banco de dados:", error);
  } finally {
    process.exit();
  }
}

syncDatabase();