import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/services/session-service';
import { listMyApiKeysAction } from '@/server/actions/api-key-actions';
import ApiKeysDashboard from './ApiKeysDashboard';

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/');
  }

  const result = await listMyApiKeysAction();

  return (
    <div className="min-h-screen bg-md-surface text-md-on-surface">
      <ApiKeysDashboard
        user={{ userName: user.userName, email: user.email }}
        initialKeys={result.success ? result.keys ?? [] : []}
      />
    </div>
  );
}
