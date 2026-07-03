'use client';

import { createContext, useContext } from 'react';

export const PerfilContext = createContext({ perfil: null, esDueno: false });

export function usePerfil() {
  return useContext(PerfilContext);
}
