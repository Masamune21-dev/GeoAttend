import type { Metadata } from 'next';
import { UserTable } from '@/components/features/admin/UserTable';

export const metadata: Metadata = {
  title: 'Kelola Pengguna',
};

export default function AdminUsersPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <UserTable />
    </div>
  );
}
