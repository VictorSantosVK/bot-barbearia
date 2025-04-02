import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Logo from "../../assets/Logo.png";
import "./LoginForm.css";

const LoginForm = () => {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await axios.post("http://localhost:3001/login", {
        usuario,
        senha,
      });
      console.log(response.data.message);
      localStorage.setItem("usuario", usuario);
      localStorage.setItem("senha", senha);
      navigate("/agendamentos");
    } catch (error) {
      setError(
        error.response?.data?.error || "Erro ao fazer login. Tente novamente."
      );
      console.error("Erro no login:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        {/* Logo Image */}
        <div className="logo-container">
          <img src={Logo} alt="JK2 Barbershop Logo" className="logo" />
        </div>

        {/* Title */}
        <h1 className="main-title">JK2 Barbershop</h1>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit} className="form">
          <div className="input-group">
            <label htmlFor="usuario" className="label">
              Usuário
            </label>
            <input
              id="usuario"
              type="text"
              placeholder="Digite seu usuário"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="input"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="senha" className="label">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              placeholder="Digite sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="input"
              required
            />
          </div>

          <button type="submit" className="button" disabled={isLoading}>
            {isLoading ? "Carregando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
