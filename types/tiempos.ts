// types/tiempos.ts

export interface TiemposProduccion {
  id?: string;
  usuario: string;
  actividad: string;
  /** Qué se hizo, en palabras: lo llena el cierre de una corrida. */
  detalle?: string;
  fecha: string;
  marca?: string;
  maquina?: string;
  sku?: string;
  /** Qué parte se cosió ("Corpiño", "Bombacha"). Sólo en prendas por partes. */
  parte?: string;
  /**
   * ⚠️ HISTÓRICO: la tablet ⛔ ya no la escribe (18-sep-2026). Era una copia de
   * `OrdenProduccion.cantidad` —lo PLANIFICADO— pegada en cada registro, así que
   * sumarla contaba la misma tanda una vez por proceso. El denominador del
   * min/prenda sale de `lib/produccion/cantidades.ts`, ⛔ no de acá.
   * Los registros nuevos quedan en 0 y eso significa "no se contó", ⛔ no "cero prendas".
   */
  cantidad?: number;
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
