import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginForm from './components/LoginForm/LoginForm'
import AgendamentoList from './components/AgendamentoList/AgendamentosList';
import CriarAgendamento from './components/CriarAgendamento/CriarAgendamento';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginForm />} />
        <Route path="/agendamentos" element={<AgendamentoList />} />
        <Route path="/novoagendamento" element={<CriarAgendamento />} />
      </Routes>
    </Router>
  );
}

export default App;