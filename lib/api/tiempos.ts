// lib/api/tiempos.ts

import axios from 'axios';
import { TiemposProduccion } from '@/types/tiempos';

const API_BASE = '/api/tiempos';

export async function getTiempos(usuario: string): Promise<TiemposProduccion[]> {
  try {
    const response = await axios.get(API_BASE, {
      params: { usuario, fecha: new Date().toISOString().split('T')[0] },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching tiempos:', error);
    throw error;
  }
}

/** La API contestó que no hay sesión (`proxy.ts`): hay que volver a entrar. */
export function esSesionVencida(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

export async function crearTiempo(tiempo: TiemposProduccion): Promise<TiemposProduccion> {
  try {
    const response = await axios.post(API_BASE, tiempo);
    // 🔴 Guardado = vuelve el registro con su id. Cualquier otra cosa (una página
    // HTML tras un redirect, como el 7-oct) ⛔ es un guardado: si se aceptara, el
    // reloj se reiniciaría y los minutos se perderían sin aviso.
    if (!response.data || typeof response.data !== 'object' || !response.data.id) {
      throw new Error('El servidor no confirmó el guardado');
    }
    return response.data;
  } catch (error) {
    console.error('Error creating tiempo:', error);
    throw error;
  }
}

export async function validarSKU(sku: string, cantidad: number): Promise<boolean> {
  try {
    const response = await axios.post(`${API_BASE}/validar`, { sku, cantidad });
    return response.data.permitido;
  } catch (error) {
    console.error('Error validating SKU:', error);
    return true;
  }
}