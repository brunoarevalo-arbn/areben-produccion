'use client';

import { useState, useEffect } from 'react';

export function useAuth() {
  const [usuario, setUsuario] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const sesion = sessionStorage.getItem('areben_usuario');
    setUsuario(sesion);
    setCargando(false);
  }, []);

  const login = (nombre: string) => {
    sessionStorage.setItem('areben_usuario', nombre);
    setUsuario(nombre);
  };

  const logout = () => {
    sessionStorage.removeItem('areben_usuario');
    setUsuario(null);
  };

  return { usuario, cargando, login, logout };
}
