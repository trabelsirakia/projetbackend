import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Briefcase, ClipboardList, Cpu, FileText, Gauge, Users, Video } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { ErrorState, Skeleton } from '../../components/ui/Feedback';
import { CHART, ChartCard, ChartTooltip, DataTable, StatTile, axisProps } from '../../components/charts/ChartKit';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import { statsApi } from '../../services/api';

const FUNNEL_LABELS = { soumise: 'Candidatures', invitee: 'Invitées', quiz_termine: 'Quiz passés', entretien_termine: 'Entretiens passés', retenue: 'Retenues' };

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => statsApi.overview().then((r) => r.data), []);
  const { data: ai } = useFetch(() => statsApi.ai().then((r) => r.data), []);

  if (error) return <div className="mx-auto max-w-7xl px-4 py-10"><ErrorState message={error} onRetry={reload} /></div>;
  const funnel = data?.funnel.map((f) => ({ ...f, label: FUNNEL_LABELS[f.step] })) || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Espace recruteur" title={`Bonjour ${user.firstName}`} description="Vue d'ensemble du recrutement : de la candidature à la décision." />
      {loading || !data ? <Skeleton className="h-96" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <StatTile icon={Briefcase} label="Offres publiées" value={data.totals.publishedJobs} />
            <StatTile icon={FileText} label="Candidatures" value={data.totals.applications} />
            <StatTile icon={Gauge} label="Matching moyen" value={`${data.totals.averageMatching}/100`} />
            <StatTile icon={ClipboardList} label="Quiz actifs" value={data.totals.activeQuizzes} />
            <StatTile icon={Video} label="Entretiens" value={data.totals.interviews} />
            <StatTile icon={Users} label="Candidats" value={data.totals.candidates} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <ChartCard title="Entonnoir de recrutement" subtitle="Candidatures ayant atteint chaque étape" table={<DataTable columns={[{ key: 'label', label: 'Étape' }, { key: 'count', label: 'Candidatures', align: 'right' }]} rows={funnel} />}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={funnel} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="label" {...axisProps} interval={0} tick={{ ...axisProps.tick, fontSize: 11 }} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip cursor={{ fill: CHART.cursor }} content={<ChartTooltip />} />
                  <Bar dataKey="count" name="candidatures" fill={CHART.series} radius={[4, 4, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Offres les plus demandées">
              <DataTable columns={[{ key: 'title', label: 'Offre' }, { key: 'applications', label: 'Cand.', align: 'right' }, { key: 'averageMatching', label: 'Match.', align: 'right' }]} rows={data.perJob} />
            </ChartCard>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[['/recruteur/quiz', ClipboardList, 'Gérer les quiz', 'CRUD, génération IA, statistiques'], ['/recruteur/entretiens', Video, 'Gérer les entretiens', 'Transcriptions, notes, décisions'], ['/recruteur/candidatures', FileText, 'Candidatures', 'Matching expliqué, invitations']].map(([to, Icon, t, d]) => (
              <Link key={to} to={to} className="card card-hover flex items-center gap-4 p-5">
                <span className="icon-chip bg-tw-tint text-tw-accent"><Icon className="size-5" /></span>
                <span><span className="block font-semibold">{t}</span><span className="text-sm text-tw-muted">{d}</span></span>
              </Link>
            ))}
          </div>
          {ai && (
            <div className="card p-5">
              <p className="flex items-center gap-2 font-semibold"><Cpu className="size-4 text-tw-accent" />Modèles IA locaux</p>
              <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {ai.huggingFace.map((m) => <li key={m.key} className="rounded-lg bg-tw-canvas p-3"><p className="font-medium">{m.name}</p><p className="text-xs text-tw-muted">{m.role}</p><p className={m.status === 'ready' ? 'text-xs text-tw-success' : 'text-xs text-tw-warning'}>{m.status}</p></li>)}
                <li className="rounded-lg bg-tw-canvas p-3"><p className="font-medium">Ollama · {ai.ollama.chatModel || '—'}</p><p className="text-xs text-tw-muted">Juge des réponses, questions IA, synthèse, chatbot</p><p className={ai.ollama.reachable ? 'text-xs text-tw-success' : 'text-xs text-tw-danger'}>{ai.ollama.reachable ? 'disponible' : 'injoignable'}</p></li>
                <li className="rounded-lg bg-tw-canvas p-3"><p className="font-medium">Visioconférence</p><p className="text-xs text-tw-muted">{ai.googleMeet}</p></li>
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
