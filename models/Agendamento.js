require("dotenv").config({ path: __dirname + "/../.env" });

const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",

    // Timezone da conexão — usado pelo Sequelize para colunas
    // DATE/DATETIME "de verdade" (Venda.data, Despesa.data).
    // NÃO tem efeito sobre colunas DATEONLY (Agendamento.data):
    // o _stringify do DATEONLY ignora esse valor e usa o fuso
    // local do processo Node — por isso, para Agendamento.data,
    // nunca dependemos deste `timezone`, só de strings puras.
    timezone: "-03:00",

    dialectOptions: {
      timezone: "-03:00",

      // Faz o driver mysql2 devolver colunas do tipo DATE como
      // string ("YYYY-MM-DD"), em vez de construir um objeto
      // Date. Sem isso, a leitura de Agendamento.data (DATEONLY)
      // ficaria sujeita ao mesmo tipo de bug de fuso que a
      // escrita tinha — o valor lido dependeria do fuso local
      // do servidor que está rodando o Node.
      // Escopado só a 'DATE' para não alterar o comportamento
      // de DATETIME/TIMESTAMP (Venda.data, Despesa.data).
      dateStrings: ["DATE"],
    },

    logging: console.log,
  }
);

sequelize
  .authenticate()
  .then(() => console.log("Conexão com o banco de dados estabelecida com sucesso."))
  .catch((err) => console.error("Erro ao conectar ao banco de dados:", err));

module.exports = sequelize;