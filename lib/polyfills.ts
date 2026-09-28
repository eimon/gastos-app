// lib/polyfills.ts - Polyfills para funciones no disponibles en React Native

// Polyfill mejorado para structuredClone
if (typeof global.structuredClone === 'undefined') {
  // Named `structuredCloneImpl` (not `structuredClone`) because the recursive
  // helper takes an internal `seen` WeakMap that the real `structuredClone`
  // signature (value, options?: StructuredSerializeOptions) does not have.
  const structuredCloneImpl = function structuredCloneImpl(obj: any, seen: WeakMap<any, any> = new WeakMap()): any {
    // Manejar valores primitivos y null/undefined
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    // Prevenir referencias circulares
    if (seen.has(obj)) {
      throw new Error('Converting circular structure to cloned object');
    }
    
    // Manejar tipos especiales
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (obj instanceof RegExp) {
      return new RegExp(obj.source, obj.flags);
    }
    
    if (obj instanceof Map) {
      const clonedMap = new Map();
      seen.set(obj, clonedMap);
      for (const [key, value] of obj) {
        clonedMap.set(structuredCloneImpl(key, seen), structuredCloneImpl(value, seen));
      }
      seen.delete(obj);
      return clonedMap;
    }
    
    if (obj instanceof Set) {
      const clonedSet = new Set();
      seen.set(obj, clonedSet);
      for (const value of obj) {
        clonedSet.add(structuredCloneImpl(value, seen));
      }
      seen.delete(obj);
      return clonedSet;
    }
    
    if (obj instanceof Array) {
      const clonedArray: any[] = [];
      seen.set(obj, clonedArray);
      for (let i = 0; i < obj.length; i++) {
        clonedArray[i] = structuredCloneImpl(obj[i], seen);
      }
      seen.delete(obj);
      return clonedArray;
    }
    
    // Manejar objetos planos
    if (typeof obj === 'object') {
      const cloned: any = {};
      seen.set(obj, cloned);
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          cloned[key] = structuredCloneImpl(obj[key], seen);
        }
      }
      seen.delete(obj);
      return cloned;
    }
    
    return obj;
  };

  global.structuredClone = structuredCloneImpl as typeof global.structuredClone;
}

// Exportar para uso explícito si es necesario
export const structuredClone = global.structuredClone;