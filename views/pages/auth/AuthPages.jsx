import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Lock, Mail, Phone, User } from 'lucide-react';
import TextField from '../../components/ui/TextField';
import SelectField from '../../components/ui/SelectField';
import Button from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import useAuth from '../../hooks/useAuth';
import { authApi } from '../../services/api';
import { applyFieldErrors, errorMessage } from '../../services/client';
import { homeFor } from '../../routes/guards';

const PASSWORD_RULES = {
  required: 'Le mot de passe est obligatoire.',
  minLength: { value: 8, message: '8 caractères minimum.' },
  validate: (v) => (/[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v)) || 'Une minuscule, une majuscule et un chiffre au minimum.',
};
const EMAIL_RULES = { required: 'L\'e-mail est obligatoire.', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Adresse e-mail invalide.' } };

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
      <div className="brand-panel hidden flex-col justify-between rounded-2xl p-10 lg:flex">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">TalentWave Live</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-white">Un CV, un quiz, cinq minutes d'entretien.</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/75">Chaque étape est expliquée : vous savez toujours pourquoi un score a été attribué et ce que vous pouvez améliorer.</p>
        </div>
        <ul className="space-y-3 text-sm text-white/85">
          <li>• Job matching expliqué, phrase par phrase</li>
          <li>• Entretien vidéo avec un avatar, en français ou en anglais</li>
          <li>• Décision finale prise par un recruteur</li>
        </ul>
      </div>
      <div className="mx-auto w-full max-w-md self-center">
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-tw-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6 text-sm text-tw-muted">{footer}</div>}
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (values) => {
    setError(null);
    try {
      const user = await login(values);
      toast.success(`Bonjour ${user.firstName} !`);
      navigate(location.state?.from || homeFor(user), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthShell title="Connexion" subtitle="Accédez à vos candidatures, quiz et entretiens." footer={<>Pas encore de compte ? <Link to="/inscription" className="font-medium text-tw-accent hover:underline">Créer mon espace</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <TextField label="E-mail" type="email" icon={Mail} autoComplete="email" error={errors.email?.message} {...register('email', EMAIL_RULES)} />
        <TextField label="Mot de passe" type="password" icon={Lock} autoComplete="current-password" error={errors.password?.message} {...register('password', { required: 'Le mot de passe est obligatoire.' })} />
        <div className="text-right"><Link to="/mot-de-passe-oublie" className="text-sm text-tw-accent hover:underline">Mot de passe oublié ?</Link></div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Se connecter</Button>
      </form>
    </AuthShell>
  );
}

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const { register, handleSubmit, setError: setFieldError, formState: { errors, isSubmitting } } = useForm({ defaultValues: { preferredLanguage: 'fr' } });

  const onSubmit = async (values) => {
    setError(null);
    try {
      await signup(values);
      toast.success('Compte créé : choisissez une offre et postulez !');
      navigate('/offres', { replace: true });
    } catch (err) {
      if (!applyFieldErrors(err, setFieldError)) setError(errorMessage(err));
    }
  };

  return (
    <AuthShell title="Créer mon espace candidat" subtitle="Gratuit, en une minute." footer={<>Déjà inscrit·e ? <Link to="/login" className="font-medium text-tw-accent hover:underline">Se connecter</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Prénom" icon={User} autoComplete="given-name" error={errors.firstName?.message} {...register('firstName', { required: 'Le prénom est obligatoire.', minLength: { value: 2, message: '2 caractères minimum.' } })} />
          <TextField label="Nom" autoComplete="family-name" error={errors.lastName?.message} {...register('lastName', { required: 'Le nom est obligatoire.', minLength: { value: 2, message: '2 caractères minimum.' } })} />
        </div>
        <TextField label="E-mail" type="email" icon={Mail} autoComplete="email" error={errors.email?.message} {...register('email', EMAIL_RULES)} />
        <TextField label="Téléphone (facultatif)" icon={Phone} autoComplete="tel" {...register('phone')} />
        <SelectField label="Langue préférée pour l'entretien" options={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} {...register('preferredLanguage')} />
        <TextField label="Mot de passe" type="password" icon={Lock} autoComplete="new-password" hint="8 caractères, une minuscule, une majuscule et un chiffre." error={errors.password?.message} {...register('password', PASSWORD_RULES)} />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Créer mon compte</Button>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const onSubmit = async ({ email }) => {
    setError(null);
    try {
      await authApi.forgot(email);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <AuthShell title="Mot de passe oublié" subtitle="Recevez un lien de réinitialisation valable 15 minutes." footer={<Link to="/login" className="font-medium text-tw-accent hover:underline">← Retour à la connexion</Link>}>
      {sent ? (
        <Alert tone="success" title="Vérifiez votre boîte mail">Si un compte existe pour cette adresse, un lien vient d'être envoyé. Pensez aux courriers indésirables.</Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <TextField label="E-mail" type="email" icon={Mail} autoComplete="email" error={errors.email?.message} {...register('email', EMAIL_RULES)} />
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Envoyer le lien</Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [error, setError] = useState(null);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();
  const onSubmit = async ({ password }) => {
    setError(null);
    try {
      await authApi.reset(token, password);
      toast.success('Mot de passe modifié : connectez-vous.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <AuthShell title="Nouveau mot de passe">
      {!token ? <Alert tone="error">Lien incomplet : utilisez le lien reçu par e-mail.</Alert> : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <TextField label="Nouveau mot de passe" type="password" icon={Lock} autoComplete="new-password" error={errors.password?.message} {...register('password', PASSWORD_RULES)} />
          <TextField label="Confirmation" type="password" icon={Lock} autoComplete="new-password" error={errors.confirm?.message} {...register('confirm', { validate: (v) => v === watch('password') || 'Les mots de passe ne correspondent pas.' })} />
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Enregistrer</Button>
        </form>
      )}
    </AuthShell>
  );
}
