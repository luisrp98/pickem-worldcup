function slugifyTeam(s) {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildMatchId(match) {
  return `${match.date}__${slugifyTeam(match.team1)}-vs-${slugifyTeam(match.team2)}`;
}

module.exports = { slugifyTeam, buildMatchId };
