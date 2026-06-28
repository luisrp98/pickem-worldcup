import type { PointsTableData } from '../components/PointsTable.astro';

export interface RulePoints extends PointsTableData {
  intro?: string;
}

export const phaseGroupsMatches: RulePoints = {
  intro: 'Sistema de puntuación:',
  caption: 'Puntos por partido en fase de grupos',
  rows: [
    { text: 'Resultado correcto (victoria, derrota o empate)', value: '2' },
    { text: 'Marcador exacto', value: '+5', extra: true },
  ],
  max: { label: 'Máximo por partido', value: '7' },
};

export const phaseGroupsPositions: RulePoints = {
  intro: 'Sistema de puntuación:',
  caption: 'Puntos por predicción de posiciones en fase de grupos',
  rows: [
    { text: 'Cada equipo en su posición exacta dentro del grupo', value: '2' },
    { text: 'Acertar las cuatro posiciones del grupo', value: '+2', extra: true },
  ],
  max: { label: 'Máximo por grupo', value: '10' },
};

export const knockoutRounds: PointsTableData = {
  caption: 'Puntos por resultado correcto en fase eliminatoria',
  rows: [
    { text: 'Dieciseisavos de final', value: '5' },
    { text: 'Octavos de final', value: '8' },
    { text: 'Cuartos de final', value: '12' },
    { text: 'Semifinales', value: '18' },
    { text: 'Tercer puesto', value: '20' },
    { text: 'Final', value: '25' },
  ],
};

export const knockoutBonus: PointsTableData = {
  caption: 'Puntuación adicional en fase eliminatoria',
  rows: [{ text: 'Marcador exacto', value: '+5', extra: true }],
};

export const specialPredictions: RulePoints = {
  intro: 'Estas predicciones se evalúan al finalizar el torneo:',
  caption: 'Puntos por predicciones especiales',
  rows: [
    { text: 'Campeón del torneo', value: '25' },
    { text: 'Subcampeón', value: '15' },
    { text: 'Máximo goleador', value: '15' },
    { text: 'Máximo asistidor', value: '15' },
    { text: 'Mejor jugador del torneo', value: '15' },
    { text: 'Hasta dónde llega México 🇲🇽', value: '10' },
    { text: 'Equipo con más goles anotados', value: '10' },
    { text: 'Equipo con más porterías a cero', value: '10' },
  ],
};

export const knockoutTies: string[] = [
  'Si predecís empate al finalizar los 90 minutos, será <strong class="text-text font-semibold">obligatorio</strong> seleccionar qué equipo avanza a la siguiente ronda.',
  'No se otorgarán puntos adicionales por acertar el equipo clasificado.',
  "No importa si la clasificación ocurre en tiempo extra o mediante penales; se usa solo para definir quién avanza en el bracket del Pick'em.",
];

export const considerations: string[] = [
  'Esto es entre amigos: tomátelo con humor y buena onda. 🥰',
  'Las reglas están escritas para ser claras; si algo no se entiende, preguntá.',
  'Los puntos importantes siempre aparecen resaltados en color.',
  'El que queda último, tiene que picharle dogos a todos los jugadores 🍕',
];
