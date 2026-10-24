// Casos de la regla de pago de horas (sin base). npx tsx prisma/check-pago-horas.ts
import { calcularDia, calcularPeriodo, periodoDe, CONFIG_DEFECTO, type Registro } from '../lib/produccion/pago-horas';
const cfg = { ...CONFIG_DEFECTO, descuentaPausas: true }; // jornada 9 h, tolerancia 29, fracción 30, cercano; este bloque prueba la opción de descontar pausas
const r = (fecha: string, a: string, i: string, f: string, m: number): Registro => ({ fecha, actividad: a, horaInicio: i, horaFin: f, minutosNetos: m });
let mal = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) mal++; console.log(ok ? 'OK ' : 'MAL', n, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
// lun 19-oct-2026
const dia = (regs: Registro[]) => calcularDia(cfg, '2026-10-19', regs, 5500);
// 8:00–17:15, almuerzo 45 ⇒ 8h30 trabajado: falta 30 > 29 ⇒ real 510
eq('falta 30 ⇒ real', dia([r('2026-10-19', 'Proceso Completado', '08:00', '17:15', 500), r('2026-10-19', 'Almuerzo', '12:00', '12:45', 45)]).pagadoMin, 510);
// 8:00–17:44 con almuerzo 45 ⇒ 8h59… = 539 ⇒ tolerancia ⇒ 540
const t = dia([r('2026-10-19', 'Proceso Completado', '08:00', '17:44', 600), r('2026-10-19', 'Almuerzo', '12:00', '12:45', 45)]);
eq('falta 1 ⇒ jornada', [t.pagadoMin, t.motivo], [540, 'tolerancia']);
// falta 29 exacto ⇒ tolerancia
eq('falta 29 ⇒ jornada', dia([r('2026-10-19', 'Proceso Completado', '08:00', '16:31', 480)]).pagadoMin, 540);
// se fue 1 h antes: 8 h ⇒ 480
eq('1 h antes ⇒ 480', dia([r('2026-10-19', 'Proceso Completado', '08:00', '16:00', 480)]).pagadoMin, 480);
// monto 9 h a 5500 = 49.500
eq('monto 9 h', dia([r('2026-10-19', 'Proceso Completado', '08:00', '17:00', 480)]).monto, 49500);
// sin registros / sábado
eq('sin registros', dia([]).motivo, 'sin_registros');
eq('sábado no laboral', calcularDia(cfg, '2026-10-24', [], 5500).motivo, 'dia_no_laboral');
// extras con recargo 50%: 10 h ⇒ 9 + 1 h al 150%
const e = calcularDia({ ...cfg, recargoExtraPct: 50 }, '2026-10-19', [r('2026-10-19', 'Proceso Completado', '08:00', '18:00', 600)], 6000);
eq('extra 60 min', [e.extraMin, e.monto], [60, 6000 * 9 + 6000 * 1.5]);
// ajuste manual pisa
eq('ajuste', calcularDia(cfg, '2026-10-19', [], 5500, { minutos: 300 }).pagadoMin, 300);
// por defecto (presencia) el almuerzo NO se descuenta: 8:00–17:00 con 45 de almuerzo = 9 h
eq('presencia', calcularDia(CONFIG_DEFECTO, '2026-10-19', [r('2026-10-19', 'Proceso Completado', '08:00', '17:00', 480), r('2026-10-19', 'Almuerzo', '12:00', '12:45', 45)], 6000).pagadoMin, 540);
// quincena con ancla lun 12-oct: 12..25
eq('quincena', periodoDe('QUINCENAL', '2026-10-24', '2026-10-12'), { desde: '2026-10-12', hasta: '2026-10-25' });
eq('quincena siguiente', periodoDe('QUINCENAL', '2026-10-26', '2026-10-12'), { desde: '2026-10-26', hasta: '2026-11-08' });
eq('mensual', periodoDe('MENSUAL', '2026-10-24', null), { desde: '2026-10-01', hasta: '2026-10-31' });
// período: 10 días hábiles de 9 h a 5500
const regs: Registro[] = ['12', '13', '14', '15', '16', '19', '20', '21', '22', '23'].map((d) => r(`2026-10-${d}`, 'Proceso Completado', '08:00', '17:00', 480));
const p = calcularPeriodo(cfg, [{ desde: '2026-09-28', montoHora: 5500 }], regs, '2026-10-12', '2026-10-25');
eq('período', [p.totalMin, p.totalMonto, p.diasSinTarifa], [5400, 495000, 0]);
console.log(mal ? `\n${mal} FALLAS` : '\ntodo OK'); process.exit(mal ? 1 : 0);
