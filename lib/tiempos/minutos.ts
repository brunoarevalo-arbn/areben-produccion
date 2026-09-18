// Minutos a partir de dos horas del día. Dueño único de esa cuenta.
//
// 🔴 Antes era `Math.floor(segs / 60)` y se comía hasta 59 segundos de CADA registro,
// SIEMPRE para abajo ⇒ el error ⛔ no se compensaba, se acumulaba. El cronómetro de la
// tablet se arregló el 18-sep (guarda 2 decimales), pero estos dos caminos —el alta
// manual y la EDICIÓN del admin— seguían truncando: corregir a mano la máquina de un
// registro de 41,37 min lo dejaba en 41. Una corrección ⛔ no puede costar dato.
//
// ⚠️ No importa `prisma` a propósito: la usan APIs y podría usarla la tablet.

/** "HH:MM" o "HH:MM:SS" → segundos desde medianoche. */
export function horaASegundos(h: string): number {
  const [hh, mm, ss = '0'] = h.split(':');
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
}

/**
 * Minutos entre dos horas, con 2 decimales — la misma precisión que guarda
 * `useCronometro`. Negativo o cero ⇒ 0.
 */
export function minutosEntre(horaInicio: string, horaFin: string): number {
  const segs = horaASegundos(horaFin) - horaASegundos(horaInicio);
  return segs > 0 ? Math.round((segs / 60) * 100) / 100 : 0;
}
