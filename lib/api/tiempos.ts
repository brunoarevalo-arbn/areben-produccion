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

export async function crearTiempo(tiempo: TiemposProduccion): Promise<TiemposProduccion> {
  try {
    const response = await axios.post(API_BASE, tiempo);
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