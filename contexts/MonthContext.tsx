import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MonthContextType {
  mesActual: number;
  añoActual: number;
  navegarMesAnterior: () => void;
  navegarMesSiguiente: () => void;
  irMesActual: () => void;
  setSelectedDate: (month: number, year: number) => void;
}

const MonthContext = createContext<MonthContextType | undefined>(undefined);

interface MonthProviderProps {
  children: ReactNode;
}

export const MonthProvider: React.FC<MonthProviderProps> = ({ children }) => {
  const currentDate = new Date();
  const [mesActual, setMesActual] = useState<number>(currentDate.getMonth() + 1); // 1-12
  const [añoActual, setAñoActual] = useState<number>(currentDate.getFullYear());

  const navegarMesAnterior = () => {
    if (mesActual === 1) {
      setMesActual(12);
      setAñoActual(añoActual - 1);
    } else {
      setMesActual(mesActual - 1);
    }
  };

  const navegarMesSiguiente = () => {
    if (mesActual === 12) {
      setMesActual(1);
      setAñoActual(añoActual + 1);
    } else {
      setMesActual(mesActual + 1);
    }
  };

  const irMesActual = () => {
    const hoy = new Date();
    setMesActual(hoy.getMonth() + 1);
    setAñoActual(hoy.getFullYear());
  };

  const setSelectedDate = (month: number, year: number) => {
    setMesActual(month);
    setAñoActual(year);
  };

  const value: MonthContextType = {
    mesActual,
    añoActual,
    navegarMesAnterior,
    navegarMesSiguiente,
    irMesActual,
    setSelectedDate,
  };

  return (
    <MonthContext.Provider value={value}>
      {children}
    </MonthContext.Provider>
  );
};

export const useMonth = (): MonthContextType => {
  const context = useContext(MonthContext);
  if (context === undefined) {
    throw new Error('useMonth must be used within a MonthProvider');
  }
  return context;
};