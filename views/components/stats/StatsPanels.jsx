import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Award, CheckCircle2, ClipboardList, Clock, Gauge, Users, Video,
} from 'lucide-react';
import { CHART, ChartCard, ChartTooltip, DataTable, Legend, StatTile, axisProps } from '../charts/ChartKit';
import { Skeleton } from '../ui/Feedback';
import { INTERVIEW_STATUS, QUESTION_TYPES, RECOMMENDATION } from '../../utils/labels';

const PALETTE = ['var(--chart-candidat)', 'var(--chart-rh)', 'var(--chart-admin)', 'var(--chart-active)', 'var(--chart-expired)', 'var(--chart-inactive)'];
const REC_COLORS = { recommande: 'var(--chart-active)', a_revoir: 'var(--chart-rh)', non_recommande: 'var(--chart-expired)' };
const monthLabel = (m) => new Date(`${m}-15`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

function Bars({ data, x, y, height = 220, color = CHART.series, unit = '', layout }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 4, right: 8, left: layout ? 8 : -16, bottom: 0 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} horizontal={!layout} />
        {layout ? <XAxis type="number" {...axisProps} domain={[0, 100]} /> : <XAxis dataKey={x} {...axisProps} interval={0} tick={{ ...axisProps.tick, fontSize: 11 }} />}
        {layout ? <YAxis type="category" dataKey={x} {...axisProps} width={120} tick={{ ...axisProps.tick, fontSize: 11 }} /> : <YAxis {...axisProps} allowDecimals={false} />}
        <Tooltip cursor={{ fill: CHART.cursor }} content={<ChartTooltip unit={unit} />} />
        <Bar dataKey={y} name={y} fill={color} radius={layout ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Donut({ data, colors }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={150} height={150}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="var(--color-tw-surface)">
            {data.map((d, i) => <Cell key={d.label} fill={colors?.[d.key] || PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-[3px]" style={{ background: colors?.[d.key] || PALETTE[i % PALETTE.length] }} />
            <span className="text-tw-muted">{d.label}</span><strong className="tabular">{d.value}</strong>
            <span className="text-xs text-tw-muted">{total ? Math.round((100 * d.value) / total) : 0} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function QuizStats({ stats }) {
  if (!stats) return <Skeleton className="h-96" />;
  const t = stats.totals;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={ClipboardList} label="Quiz (actifs)" value={`${t.quizzes} (${t.active})`} hint={`${t.questions} questions au total`} />
        <StatTile icon={Users} label="Passages" value={t.attempts} />
        <StatTile icon={Gauge} label="Score moyen" value={`${t.averageScore}/100`} hint={`meilleur : ${t.bestScore}`} />
        <StatTile icon={CheckCircle2} label="Taux de réussite" value={`${t.passRate} %`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Distribution des scores" subtitle="Nombre de passages par tranche" empty={!t.attempts && 'Aucun passage pour le moment'}
          table={<DataTable columns={[{ key: 'range', label: 'Tranche' }, { key: 'count', label: 'Passages', align: 'right' }]} rows={stats.scoreDistribution} />}>
          <Bars data={stats.scoreDistribution} x="range" y="count" />
        </ChartCard>
        <ChartCard title="Réussite par compétence" subtitle="% de bonnes réponses (toutes questions confondues)" empty={!stats.perSkill.length && 'Aucune donnée'}
          table={<DataTable columns={[{ key: 'skill', label: 'Compétence' }, { key: 'successRate', label: '% réussite', align: 'right' }, { key: 'answered', label: 'Réponses', align: 'right' }]} rows={stats.perSkill} />}>
          <Bars data={stats.perSkill} x="skill" y="successRate" layout="vertical" unit=" %" height={Math.max(180, stats.perSkill.length * 28)} />
        </ChartCard>
        <ChartCard title="Quiz par métier" table={<DataTable columns={[{ key: 'label', label: 'Métier' }, { key: 'count', label: 'Quiz', align: 'right' }, { key: 'questions', label: 'Questions', align: 'right' }]} rows={stats.byMetier} />}>
          <Donut data={stats.byMetier.map((m) => ({ key: m.metier, label: m.label, value: m.count }))} />
        </ChartCard>
        <ChartCard title="Quiz les plus passés" empty={!stats.perQuiz.length && 'Aucun passage'}
          table={<DataTable columns={[{ key: 'title', label: 'Quiz' }, { key: 'attempts', label: 'Passages', align: 'right' }, { key: 'averageScore', label: 'Moyenne', align: 'right' }, { key: 'passRate', label: 'Réussite %', align: 'right' }]} rows={stats.perQuiz} />}>
          <DataTable columns={[{ key: 'title', label: 'Quiz' }, { key: 'attempts', label: 'Passages', align: 'right' }, { key: 'averageScore', label: 'Moy.', align: 'right' }, { key: 'passRate', label: 'Réussite', align: 'right', format: (v) => `${v} %` }]} rows={stats.perQuiz} />
        </ChartCard>
      </div>
    </div>
  );
}

export function InterviewStats({ stats }) {
  if (!stats) return <Skeleton className="h-96" />;
  const t = stats.totals;
  const statusData = stats.byStatus.map((s) => ({ key: s.status, label: INTERVIEW_STATUS[s.status]?.label || s.status, value: s.count }));
  const recData = stats.byRecommendation.map((r) => ({ key: r.recommendation, label: RECOMMENDATION[r.recommendation]?.label || r.recommendation, value: r.count }));
  const parts = [
    { part: 'Quiz', score: t.averageQuiz }, { part: 'Technique', score: t.averageTechnical }, { part: 'Communication', score: t.averageCommunication }, { part: 'Motivation', score: t.averageMotivation },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Video} label="Entretiens" value={t.interviews} hint={`${t.evaluated} évalués (${t.completionRate} %)`} />
        <StatTile icon={Gauge} label="Note moyenne" value={`${t.averageOverall}/100`} />
        <StatTile icon={Clock} label="Durée moyenne" value={`${Math.floor(t.averageDurationSec / 60)} min ${t.averageDurationSec % 60} s`} />
        <StatTile icon={Award} label="Candidats retenus" value={t.retained} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Recommandations de l'IA" subtitle="Entretiens évalués" empty={!recData.length && 'Aucun entretien évalué'}
          table={<DataTable columns={[{ key: 'label', label: 'Avis' }, { key: 'value', label: 'Entretiens', align: 'right' }]} rows={recData} />}>
          <Donut data={recData} colors={REC_COLORS} />
        </ChartCard>
        <ChartCard title="Statuts" table={<DataTable columns={[{ key: 'label', label: 'Statut' }, { key: 'value', label: 'Entretiens', align: 'right' }]} rows={statusData} />}>
          <Donut data={statusData} />
        </ChartCard>
        <ChartCard title="Note moyenne par composante" subtitle="Sur 100" table={<DataTable columns={[{ key: 'part', label: 'Composante' }, { key: 'score', label: 'Moyenne', align: 'right' }]} rows={parts} />}>
          <Bars data={parts} x="part" y="score" layout="vertical" height={180} />
        </ChartCard>
        <ChartCard title="Distribution des notes" empty={!t.evaluated && 'Aucun entretien évalué'} table={<DataTable columns={[{ key: 'range', label: 'Tranche' }, { key: 'count', label: 'Entretiens', align: 'right' }]} rows={stats.scoreDistribution} />}>
          <Bars data={stats.scoreDistribution} x="range" y="count" color="var(--chart-admin)" />
        </ChartCard>
        <ChartCard title="Score moyen par type de question" table={<DataTable columns={[{ key: 'label', label: 'Type' }, { key: 'averageScore', label: 'Moyenne', align: 'right' }, { key: 'answers', label: 'Réponses', align: 'right' }]} rows={stats.perQuestionType.map((p) => ({ ...p, label: QUESTION_TYPES[p.type] }))} />}>
          <Bars data={stats.perQuestionType.map((p) => ({ ...p, label: QUESTION_TYPES[p.type] }))} x="label" y="averageScore" />
        </ChartCard>
        <ChartCard title="Évolution mensuelle" legend={<Legend items={[{ label: 'Planifiés', color: CHART.series, shape: 'line' }, { label: 'Évalués', color: 'var(--chart-active)', shape: 'line' }]} />}
          table={<DataTable columns={[{ key: 'month', label: 'Mois' }, { key: 'planned', label: 'Planifiés', align: 'right' }, { key: 'evaluated', label: 'Évalués', align: 'right' }, { key: 'averageOverall', label: 'Moyenne', align: 'right' }]} rows={stats.perMonth} />}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.perMonth} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
              <YAxis {...axisProps} allowDecimals={false} />
              <Tooltip content={<ChartTooltip labelFormatter={monthLabel} />} />
              <Line dataKey="planned" name="Planifiés" stroke={CHART.series} strokeWidth={2} dot={{ r: 3 }} />
              <Line dataKey="evaluated" name="Évalués" stroke="var(--chart-active)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Langue des réponses" subtitle="Détectée par Whisper (oral) ou par le texte" table={<DataTable columns={[{ key: 'language', label: 'Langue' }, { key: 'answers', label: 'Réponses', align: 'right' }]} rows={stats.byLanguage} />}>
          <Donut data={stats.byLanguage.map((l) => ({ key: l.language, label: l.language === 'fr' ? 'Français' : l.language === 'en' ? 'Anglais' : l.language, value: l.answers }))} />
        </ChartCard>
        <ChartCard title="Notes par métier" table={<DataTable columns={[{ key: 'label', label: 'Métier' }, { key: 'count', label: 'Entretiens', align: 'right' }, { key: 'averageOverall', label: 'Moyenne', align: 'right' }]} rows={stats.byMetier} />}>
          <Bars data={stats.byMetier} x="label" y="averageOverall" layout="vertical" height={Math.max(160, stats.byMetier.length * 34)} color="var(--chart-rh)" />
        </ChartCard>
      </div>
    </div>
  );
}

