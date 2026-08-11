require("dotenv").config({ path: __dirname + "/../.env" });
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME, 
  process.env.DB_USER, 
  process.env.DB_PASSWORD, 
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: console.log,
  }
);

// Testar a conexão
sequelize.authenticate()
  .then(() => console.log("Conexão com o banco de dados estabelecida com sucesso."))
  .catch((err) => console.error("Erro ao conectar ao banco de dados:", err));

module.exports = sequelize;
