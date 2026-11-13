const { STATS_TIMEZONE } = require('../constants');

// Les `count` derniers mois (le mois courant en dernier), dans le fuseau des statistiques.
function lastMonths(count, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: STATS_TIMEZONE, year: 'numeric', month: '2-digit' }).formatToParts(now);
  let year = Number(parts.find((p) => p.type === 'year').value);
  let month = Number(parts.find((p) => p.type === 'month').value);
  const months = [];
  for (let i = 0; i < count; i += 1) {
    months.unshift({ year, month });
    month -= 1;
    if (month === 0) { month = 12; year -= 1; }
  }
  return months;
}

// Début (avec un jour de marge pour le fuseau) de la fenêtre couverte par lastMonths.
const windowStart = (months) => new Date(Date.UTC(months[0].year, months[0].month - 1, 1) - 24 * 3600 * 1000);

const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

const monthLabel = (year, month) => new Date(Date.UTC(year, month - 1, 15))
  .toLocaleDateString('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' });

// Expression d'agrégation { year, month } dans le fuseau des statistiques.
const groupByMonth = (field) => ({
  year: { $year: { date: field, timezone: STATS_TIMEZONE } },
  month: { $month: { date: field, timezone: STATS_TIMEZONE } },
});

module.exports = { lastMonths, windowStart, monthKey, monthLabel, groupByMonth };
