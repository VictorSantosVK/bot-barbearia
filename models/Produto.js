const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Produto = sequelize.define(
  "Produto",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    nome: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    preco_custo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    preco_venda: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    estoque: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    estoque_minimo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    ativo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "produtos",
    timestamps: true,
  }
);

module.exports = Produto;