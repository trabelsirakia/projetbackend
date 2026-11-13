/** Libellés et tons des statuts (une seule source pour toute l'interface). */
export const METIERS = {
  'dev-fullstack': 'Développeur·se Full Stack',
  'data-scientist': 'Data Scientist',
  'devops-cloud': 'DevOps / Cloud',
  'designer-ux': 'Designer UX/UI',
  'marketing-digital': 'Marketing digital',
  comptable: 'Comptabilité / Gestion',
};
export const metierOptions = (all = 'Tous les métiers') => [{ value: '', label: all }, ...Object.entries(METIERS).map(([value, label]) => ({ value, label }))];

const tone = {
  neutral: 'border border-tw-line bg-tw-canvas text-tw-muted',
  info: 'bg-tw-tint text-tw-accent',
  success: 'bg-tw-success-soft text-tw-success',
  warning: 'bg-tw-warning-soft text-tw-warning',
  danger: 'bg-tw-danger-soft text-tw-danger',
};

export const APPLICATION_STATUS = {
  soumise: { label: 'Déposée', cls: tone.neutral, step: 0 },
  refusee: { label: 'Non retenue (CV)', cls: tone.danger, step: 0 },
  invitee: { label: 'Invité·e : quiz à passer', cls: tone.info, step: 1 },
  quiz_termine: { label: 'Entretien à passer', cls: tone.info, step: 2 },
  entretien_termine: { label: 'Décision en attente', cls: tone.warning, step: 3 },
  retenue: { label: 'Retenue', cls: tone.success, step: 4 },
  non_retenue: { label: 'Non retenue', cls: tone.danger, step: 4 },
  retiree: { label: 'Retirée', cls: tone.neutral, step: 0 },
};

export const INTERVIEW_STATUS = {
  planifie: { label: 'Planifié', cls: tone.info },
  en_cours: { label: 'En cours', cls: tone.warning },
  termine: { label: 'Analyse en cours', cls: tone.warning },
  evalue: { label: 'Évalué', cls: tone.success },
  annule: { label: 'Annulé', cls: tone.neutral },
  expire: { label: 'Expiré', cls: tone.danger },
};

export const RECOMMENDATION = {
  recommande: { label: 'Recommandé', cls: tone.success },
  a_revoir: { label: 'À revoir', cls: tone.warning },
  non_recommande: { label: 'Non recommandé', cls: tone.danger },
};

export const DECISION = {
  en_attente: { label: 'En attente', cls: tone.neutral },
  retenu: { label: 'Retenu', cls: tone.success },
  non_retenu: { label: 'Non retenu', cls: tone.danger },
};

export const QUIZ_STATUS = {
  actif: { label: 'Actif', cls: tone.success },
  inactif: { label: 'Inactif', cls: tone.neutral },
  archive: { label: 'Archivé', cls: tone.warning },
};

export const QUESTION_TYPES = { presentation: 'Présentation', technique: 'Technique', situation: 'Mise en situation', motivation: 'Motivation' };

export const fmtDate = (d, opts = { dateStyle: 'medium', timeStyle: 'short' }) => (d ? new Date(d).toLocaleString('fr-FR', opts) : '—');
export const fmtDay = (d) => fmtDate(d, { dateStyle: 'medium' });

export const scoreTone = (s) => (s == null ? 'text-tw-muted' : s >= 70 ? 'text-tw-success' : s >= 50 ? 'text-tw-warning' : 'text-tw-danger');
export const scoreBar = (s) => (s == null ? 'bg-tw-line' : s >= 70 ? 'bg-tw-success' : s >= 50 ? 'bg-tw-warning' : 'bg-tw-danger');
