// types/global.d.ts - Declaraciones de tipos globales

declare global {
  function structuredClone<T>(value: T): T;
  
  namespace NodeJS {
    interface Global {
      structuredClone: <T>(value: T) => T;
    }
  }
}

export {};