const SCORING_VERSION = 1;

function calculateMatchPoints(match, prediction) {
  if (!match?.score?.ft) return null;
  const [real1, real2] = match.score.ft;
  const result = real1 === real2 ? 'draw' : real1 > real2 ? 'home' : 'away';

  if (!prediction) {
    return { points: 0, resultado: false, marcador: false };
  }

  const predResult =
    prediction.score1 === prediction.score2 ? 'draw' : prediction.score1 > prediction.score2 ? 'home' : 'away';

  const resultado = result === predResult;
  const marcador = prediction.score1 === real1 && prediction.score2 === real2;
  const points = (resultado ? 2 : 0) + (marcador ? 5 : 0);
  return { points, resultado, marcador };
}

module.exports = { calculateMatchPoints, SCORING_VERSION };
