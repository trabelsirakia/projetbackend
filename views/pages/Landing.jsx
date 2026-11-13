import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight, BrainCircuit, ClipboardCheck, FileUp, Languages, MailCheck, MessagesSquare, ShieldCheck, Video,
} from 'lucide-react';
import Button from '../components/ui/Button';
import useAuth from '../hooks/useAuth';
import { homeFor } from '../routes/guards';

const BREAKDOWN = [['Compétences techniques', 86], ['Expérience', 78], ['Langues', 100], ['Compétences humaines', 70]];

const STEPS = [
  { icon: FileUp, title: 'Postulez', text: 'Choisissez une offre, cliquez sur « Postuler » et déposez votre CV en PDF.' },
  { icon: BrainCircuit, title: 'Job matching IA', text: 'Votre CV est comparé au poste : score sur 100, chaque point expliqué.' },
  { icon: MailCheck, title: 'E-mail d\'acceptation', text: 'Au-dessus du seuil : lien du quiz, salle d\'entretien et lien Google Meet.' },
  { icon: ClipboardCheck, title: 'Quiz de compétences', text: 'Un QCM chronométré sur les compétences du poste, corrigé immédiatement.' },
  { icon: Video, title: 'Entretien avec l\'avatar', text: '5 minutes, 5 questions à l\'oral, en français ou en anglais.' },
  { icon: ShieldCheck, title: 'Résultat et décision', text: 'Notes et conseils par question ; un recruteur valide et vous écrit.' },
];

const FEATURES = [
  { icon: Languages, title: 'Réponses en français ou en anglais', text: 'Whisper détecte la langue de chaque réponse orale et la transcrit fidèlement.' },
  { icon: BrainCircuit, title: 'Une notation explicable', text: 'Chaque réponse est comparée à une grille d\'attendus du métier : vous voyez ce qui a été couvert.' },
  { icon: MessagesSquare, title: 'Un assistant pour s\'entraîner', text: 'Nora répond à vos questions et vous fait répéter de vraies questions d\'entretien.' },
];

const fade = { initial: { opacity: 0, y: 14 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.45 } };

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cta = () => navigate(user ? homeFor(user) : '/inscription');

  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="eyebrow">Recrutement · Équipe DataWave · ESPRIT</p>
          <h1 className="mt-5 text-[40px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[56px]">
            Postulez avec votre CV.<br />On s'occupe du reste.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-tw-muted">
            Choisissez une offre et déposez votre CV en PDF. L'IA le compare au poste visé et explique chaque point ; un quiz puis un
            entretien vidéo de 5 minutes avec notre avatar complètent votre candidature. Un recruteur valide la décision et vous écrit.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button size="lg" onClick={cta}>Accéder à mon espace <ArrowRight className="size-4" /></Button>
            <Button size="lg" variant="secondary" onClick={() => navigate('/offres')}>Voir les offres</Button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1 }} className="card overflow-hidden shadow-[var(--shadow-raise)]">
          <div className="flex items-start justify-between gap-4 border-b border-tw-line p-6">
            <div>
              <p className="eyebrow">Correspondance avec l'offre</p>
              <p className="mt-2 text-lg font-semibold">Développeur·se Full Stack · candidature</p>
            </div>
            <p className="shrink-0 text-tw-accent"><span className="text-4xl font-bold tabular">81</span><span className="text-tw-muted">/100</span></p>
          </div>
          <ul className="divide-y divide-tw-line px-6">
            {BREAKDOWN.map(([label, v], i) => (
              <li key={label} className="flex items-center gap-4 py-4 text-[15px]">
                <span className="flex-1 text-tw-muted">{label}</span>
                <span className="h-1 w-28 overflow-hidden rounded-full bg-tw-canvas sm:w-36">
                  <motion.span className="block h-full rounded-full bg-tw-primary" initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }} />
                </span>
                <span className="w-9 text-right font-semibold tabular">{v}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-tw-line bg-tw-canvas px-6 py-5">
            <p className="eyebrow">Pourquoi ce score</p>
            <p className="mt-3 text-[15px] leading-relaxed">+ 6 compétences obligatoires sur 7, chacune prouvée par une phrase du CV.</p>
            <p className="mt-1 text-[15px] leading-relaxed">– Docker demandé mais absent ; 2 ans d'expérience sur 3 attendus.</p>
          </div>
        </motion.div>
      </section>

      <section id="comment" className="border-y border-tw-line bg-tw-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <motion.div {...fade}>
            <p className="eyebrow">Comment ça marche</p>
            <h2 className="mt-3 text-3xl font-semibold">Tout commence quand vous cliquez sur « Postuler »</h2>
          </motion.div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <motion.li key={title} {...fade} transition={{ duration: 0.4, delay: i * 0.06 }} className="card card-hover p-6">
                <div className="flex items-center gap-3">
                  <span className="icon-chip bg-tw-tint text-tw-accent"><Icon className="size-5" /></span>
                  <span className="text-xs font-semibold text-tw-muted">Étape {i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-tw-muted">{text}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <motion.div key={title} {...fade} className="flex gap-4">
              <span className="icon-chip bg-tw-canvas text-tw-accent ring-1 ring-tw-line"><Icon className="size-5" /></span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-tw-muted">{text}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div {...fade} className="brand-panel mt-14 flex flex-col items-start justify-between gap-6 rounded-2xl p-8 sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-2xl font-semibold text-white">Prêt·e pour votre prochain poste ?</h2>
            <p className="mt-2 text-sm text-white/75">Créez votre espace en une minute et postulez avec votre CV.</p>
          </div>
          <Link to={user ? homeFor(user) : '/inscription'} className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-[15px] font-semibold text-[#0F2238] hover:bg-white/90">
            Commencer <ArrowRight className="size-4" />
          </Link>
        </motion.div>
      </section>
    </>
  );
}
