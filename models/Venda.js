const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Venda = sequelize.define(
  "Venda",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    produto_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    quantidade: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    valor_unitario: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    valor_total: {
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
    tableName: "vendas",
    timestamps: false,
  }
);

module.exports = Venda;