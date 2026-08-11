const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Agendamento = sequelize.define(
  "Agendamento",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    nome_cliente: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    telefone: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // DATEONLY (não DATE/DATETIME): um agendamento tem um "dia de
    // calendário", não um instante no tempo. Guardar como DATEONLY
    // evita qualquer conversão de fuso horário na escrita/leitura —
    // o valor sempre é a string "YYYY-MM-DD" tal como foi enviada,
    // sem depender do TZ do processo Node nem do SO.
    data: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    horario: {
      type: DataTypes.TIME,
      allowNull: false,
    },

    servico: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    preco_servico: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },

    // Marca se o serviço já foi realizado/pago. Usado para calcular o
    // faturamento do dia, da semana e do mês no painel admin.
    concluido: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = Agendamento;