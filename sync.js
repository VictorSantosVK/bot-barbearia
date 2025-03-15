const sequelize = require("./config/database");
const Agendamento = require("./models/Agendamento");

async function syncDatabase() {
  try {
    await sequelize.sync({ force: false }); // false para não apagar os dados existentes
    console.log("Banco de dados sincronizado!");
  } catch (error) {
    console.error("Erro ao sincronizar o banco de dados:", error);
  } finally {
    process.exit();
  }
}

syncDatabase();
