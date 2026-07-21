'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ApiKeySummary,
  createMyApiKeyAction,
  listMyApiKeysAction,
  rotateMyApiKeyAction,
} from '@/app/actions/api-key-actions';

interface RevealedSecret {
  apiKey: string;
  clientSecret: string;
}

export default function ApiKeysDashboard({
  user,
  initialKeys,
}: {
  user: { userName: string; email: string };
  initialKeys: ApiKeySummary[];
}) {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeySummary[]>(initialKeys);
  const [name, setName] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [revealedSecret, setRevealedSecret] = useState<RevealedSecret | null>(null);
  const [isPending, startTransition] = useTransition();
  const [rotatingKey, setRotatingKey] = useState<string | null>(null);

  const refreshKeys = async () => {
    const result = await listMyApiKeysAction();
    if (result.success) {
      setKeys(result.keys || []);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    startTransition(async () => {
      const domains = allowedDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
      const result = await createMyApiKeyAction(name.trim(), domains);
      if (result.success && result.apiKey && result.clientSecret) {
        toast.success('API key created');
        setRevealedSecret({ apiKey: result.apiKey, clientSecret: result.clientSecret });
        setName('');
        setAllowedDomains('');
        await refreshKeys();
      } else {
        toast.error(result.error || 'Failed to create API key');
      }
    });
  };

  const handleRotate = (apiKey: string) => {
    setRotatingKey(apiKey);
    startTransition(async () => {
      const result = await rotateMyApiKeyAction(apiKey);
      setRotatingKey(null);
      if (result.success && result.apiKey && result.clientSecret) {
        toast.success('API key secret rotated');
        setRevealedSecret({ apiKey: result.apiKey, clientSecret: result.clientSecret });
        await refreshKeys();
      } else {
        toast.error(result.error || 'Failed to rotate API key');
      }
    });
  };

  const handleLogout = async () => {
    await fetch('/api/private/auth/logout', { method: 'POST' });
    toast.info('Logged out');
    router.push('/');
    router.refresh();
  };

  const copyToClipboard = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">API Keys</h1>
          <p className="text-sm text-brand-text-secondary">
            Signed in as {user.userName} ({user.email})
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-text-secondary transition-colors hover:border-brand-border-active hover:text-brand-text-primary"
        >
          Log out
        </button>
      </header>

      {revealedSecret && (
        <div className="mb-8 rounded-xl border border-brand-orange/40 bg-brand-orange/5 p-4">
          <p className="mb-2 text-sm font-medium text-brand-orange">
            Save this client secret now — it will not be shown again.
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-surface px-3 py-2">
              <span className="truncate font-mono text-xs text-brand-text-secondary">{revealedSecret.apiKey}</span>
              <button onClick={() => copyToClipboard(revealedSecret.apiKey)} className="shrink-0 text-xs text-brand-orange">
                Copy key
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-surface px-3 py-2">
              <span className="truncate font-mono text-xs text-brand-text-secondary">{revealedSecret.clientSecret}</span>
              <button onClick={() => copyToClipboard(revealedSecret.clientSecret)} className="shrink-0 text-xs text-brand-orange">
                Copy secret
              </button>
            </div>
          </div>
          <button
            onClick={() => setRevealedSecret(null)}
            className="mt-3 text-xs text-brand-text-secondary underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="glass-panel mb-10 flex flex-col gap-3 rounded-xl p-5 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-brand-text-secondary">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production backend"
            className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-border-active"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-brand-text-secondary">Allowed domains (optional, comma separated)</label>
          <input
            value={allowedDomains}
            onChange={(e) => setAllowedDomains(e.target.value)}
            placeholder="app.example.com"
            className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-border-active"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-orange px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-orange-hover disabled:opacity-50"
        >
          Create API Key
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {keys.length === 0 && (
          <p className="text-sm text-brand-text-secondary">You haven&apos;t created any API keys yet.</p>
        )}
        {keys.map((key) => (
          <div key={key.id} className="glass-card flex flex-col gap-3 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{key.name}</p>
              <p className="font-mono text-xs text-brand-text-secondary">{key.apiKey}</p>
              <p className="mt-1 text-xs text-brand-text-secondary">
                {key.status} · {key.rateLimit} req/min · created {new Date(key.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => handleRotate(key.apiKey)}
              disabled={isPending && rotatingKey === key.apiKey}
              className="shrink-0 rounded-lg border border-brand-border px-4 py-2 text-sm transition-colors hover:border-brand-border-active disabled:opacity-50"
            >
              {rotatingKey === key.apiKey ? 'Rotating…' : 'Rotate Secret'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
