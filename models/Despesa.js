const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Despesa = sequelize.define(
  "Despesa",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    descricao: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    categoria: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    data: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "despesas",
    timestamps: false,
  }
);

module.exports = Despesa;