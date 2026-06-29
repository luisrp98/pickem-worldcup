import type { PointsTableData } from '../components/PointsTable.astro';

export interface RulePoints extends PointsTableData {
  intro?: string;
}

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
    { text: 'Campeón del torneo', value: '20' },
    { text: 'Subcampeón', value: '15' },
    { text: 'Balón de Oro del torneo', value: '15' },
    { text: 'Bota de Oro (máximo goleador)', value: '15' },
    { text: 'Máximo asistidor', value: '12' },
    { text: 'Guante de Oro (mejor portero)', value: '12' },
    { text: 'Mejor Jugador Joven', value: '12' },
    { text: 'Equipo con más goles anotados', value: '10' },
    { text: 'Equipo con menos goles recibidos', value: '10' },
    { text: '¿Hasta dónde llega México 🇲🇽?', value: '1-20' },
    { text: '¿Ochoa juega al menos un minuto?', value: '5' },
  ],
};

export const considerations: string[] = [
  'Esto es entre amigos: tómatelo con buen humor. 🥰',
  'Las reglas están escritas para ser claras; si algo no se entiende, pregunta.',
  'Los puntos importantes siempre aparecen resaltados en color.',
  'El que queda último, tiene que picharle dogos a todos los jugadores 🍕',
];
