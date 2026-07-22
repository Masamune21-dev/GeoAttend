import type { Metadata } from 'next';
import { ProfileForm } from '@/components/features/profile/ProfileForm';

export const metadata: Metadata = {
  title: 'Profil',
};

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-lg">
      <ProfileForm />
    </div>
  );
}
