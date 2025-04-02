require("dotenv").config({ path: __dirname + "/../.env" });

console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD);
console.log("DB_HOST:", process.env.DB_HOST);

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
