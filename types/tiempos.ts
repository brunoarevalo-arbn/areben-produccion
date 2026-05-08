// types/tiempos.ts

export interface TiemposProduccion {
  id?: string;
  usuario: string;
  actividad: string;
  fecha: string;
  marca?: string;
  maquina?: string;
  sku?: string;
  cantidad: number;
  defectos: number;
  horaInicio?: string;
  horaFin?: string;
  minutosNetos: number;
  estado?: string;
  inconveniente?: string;
  inconvenienteNotas?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TareaCurso {
  horaInicio: Date;
  horaFin?: Date;
  minutosNetos: number;
  tiempoDisplay: string;
}

export interface SKU {
  sku: string;
  prefijo: string;
}
