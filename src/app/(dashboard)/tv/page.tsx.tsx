"use client";

import { useEffect, useState } from "react";

export default function DashboardTV() {
  const [time, setTime] = useState(new Date());

  // Atualiza relógio e dados
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
      // aqui depois você chama API pra atualizar indicadores
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-screen h-screen bg-slate-900 text-white flex flex-col p-8">
      
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Painel do Escritório</h1>
        <span className="text-xl">
          Atualizado: {time.toLocaleTimeString()}
        </span>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-4 gap-6 flex-1">
        
        <div className="bg-red-600 rounded-2xl p-6">
          <h2 className="text-lg">Atrasadas</h2>
          <p className="text-5xl font-bold">12</p>
        </div>

        <div className="bg-yellow-500 rounded-2xl p-6">
          <h2 className="text-lg">Vencem hoje</h2>
          <p className="text-5xl font-bold">5</p>
        </div>

        <div className="bg-blue-500 rounded-2xl p-6">
          <h2 className="text-lg">Em andamento</h2>
          <p className="text-5xl font-bold">18</p>
        </div>

        <div className="bg-green-600 rounded-2xl p-6">
          <h2 className="text-lg">Concluídas</h2>
          <p className="text-5xl font-bold">23</p>
        </div>

      </div>
    </div>
  );
}