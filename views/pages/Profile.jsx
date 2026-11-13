import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import TextField from '../components/ui/TextField';
import SelectField from '../components/ui/SelectField';
import Button from '../components/ui/Button';
import { RoleBadge } from '../components/ui/Badges';
import useAuth from '../hooks/useAuth';
import { authApi } from '../services/api';
import { setAccessToken, errorMessage } from '../services/client';

export default function Profile() {
  const { user, setUser } = useAuth();
  const info = useForm({ defaultValues: { firstName: user.firstName, lastName: user.lastName, phone: user.phone || '', preferredLanguage: user.preferredLanguage } });
  const pwd = useForm();

  const saveInfo = async (values) => {
    try {
      const res = await authApi.updateMe(values);
      setUser(res.data.user);
      toast.success(res.message);
    } catch (err) { toast.error(errorMessage(err)); }
  };
  const savePwd = async (values) => {
    try {
      const res = await authApi.changePassword(values);
      setAccessToken(res.data.accessToken);
      pwd.reset();
      toast.success(res.message);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <PageHeader eyebrow="Compte" title="Mon profil" description={user.email} actions={<RoleBadge role={user.role} />} />
      <form onSubmit={info.handleSubmit(saveInfo)} className="card space-y-4 p-6">
        <h2 className="font-semibold">Informations</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Prénom" {...info.register('firstName', { required: true, minLength: 2 })} />
          <TextField label="Nom" {...info.register('lastName', { required: true, minLength: 2 })} />
          <TextField label="Téléphone" {...info.register('phone')} />
          <SelectField label="Langue préférée" options={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} {...info.register('preferredLanguage')} />
        </div>
        <Button type="submit" loading={info.formState.isSubmitting}>Enregistrer</Button>
      </form>
      <form onSubmit={pwd.handleSubmit(savePwd)} className="card space-y-4 p-6">
        <h2 className="font-semibold">Mot de passe</h2>
        <TextField label="Mot de passe actuel" type="password" icon={Lock} {...pwd.register('currentPassword', { required: true })} />
        <TextField label="Nouveau mot de passe" type="password" icon={Lock} hint="8 caractères, une minuscule, une majuscule et un chiffre." {...pwd.register('newPassword', { required: true, minLength: 8 })} />
        <Button type="submit" loading={pwd.formState.isSubmitting}>Changer le mot de passe</Button>
      </form>
    </div>
  );
}
