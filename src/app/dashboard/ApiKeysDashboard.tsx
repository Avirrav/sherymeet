'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ApiKeySummary,
  createMyApiKeyAction,
  listMyApiKeysAction,
  rotateMyApiKeyAction,
} from '@/server/actions/api-key-actions';

interface RevealedSecret {
  apiKey: string;
  clientSecret: string;
}

// Fixed locale + options so the server-rendered HTML and the client's
// hydration pass produce byte-identical text regardless of either side's
// default locale (bare toLocaleDateString() caused a hydration mismatch).
function formatCreatedDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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
          <h1 className="text-3xl font-normal tracking-tight">API Keys</h1>
          <p className="text-sm text-md-on-surface-variant">
            Signed in as {user.userName} ({user.email})
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="btn-press md-state-layer rounded-md-full border border-md-outline px-6 py-2.5 text-sm font-medium text-md-primary"
        >
          Log out
        </button>
      </header>

      {revealedSecret && (
        <div className="mb-8 rounded-md-md border border-md-tertiary/40 bg-md-tertiary-container/50 p-5">
          <p className="mb-3 text-sm font-medium text-md-on-tertiary-container">
            Save this client secret now — it will not be shown again.
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-2 rounded-md-sm bg-md-surface-container-highest px-3 py-2.5">
              <span className="truncate font-mono text-xs text-md-on-surface-variant">{revealedSecret.apiKey}</span>
              <button onClick={() => copyToClipboard(revealedSecret.apiKey)} className="shrink-0 text-xs font-medium text-md-primary hover:underline">
                Copy key
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md-sm bg-md-surface-container-highest px-3 py-2.5">
              <span className="truncate font-mono text-xs text-md-on-surface-variant">{revealedSecret.clientSecret}</span>
              <button onClick={() => copyToClipboard(revealedSecret.clientSecret)} className="shrink-0 text-xs font-medium text-md-primary hover:underline">
                Copy secret
              </button>
            </div>
          </div>
          <button
            onClick={() => setRevealedSecret(null)}
            className="mt-3 text-xs text-md-on-surface-variant underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="mb-10 flex flex-col gap-4 rounded-md-md bg-md-surface-container-low border border-md-outline-variant/40 p-6 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-xs font-medium text-md-on-surface-variant">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production backend"
            className="w-full rounded-md-xs border border-md-outline bg-transparent px-4 py-3 text-sm text-md-on-surface outline-none transition-colors focus:border-md-primary"
          />
        </div>
        <div className="flex-1">
          <label className="mb-2 block text-xs font-medium text-md-on-surface-variant">Allowed domains (optional, comma separated)</label>
          <input
            value={allowedDomains}
            onChange={(e) => setAllowedDomains(e.target.value)}
            placeholder="app.example.com"
            className="w-full rounded-md-xs border border-md-outline bg-transparent px-4 py-3 text-sm text-md-on-surface outline-none transition-colors focus:border-md-primary"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="btn-press rounded-md-full bg-md-primary px-6 py-2.5 text-sm font-medium text-md-on-primary transition-colors hover:bg-md-primary-hover disabled:opacity-50"
        >
          Create API Key
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {keys.length === 0 && (
          <p className="text-sm text-md-on-surface-variant">You haven&apos;t created any API keys yet.</p>
        )}
        {keys.map((key) => (
          <div key={key.id} className="flex flex-col gap-3 rounded-md-md bg-md-surface-container-low border border-md-outline-variant/40 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{key.name}</p>
              <p className="font-mono text-xs text-md-on-surface-variant">{key.apiKey}</p>
              <p className="mt-1 text-xs text-md-on-surface-variant">
                {key.status} · {key.rateLimit} req/min · created {formatCreatedDate(key.createdAt)}
              </p>
            </div>
            <button
              onClick={() => handleRotate(key.apiKey)}
              disabled={isPending && rotatingKey === key.apiKey}
              className="btn-press md-state-layer shrink-0 rounded-md-full border border-md-outline px-6 py-2.5 text-sm font-medium text-md-primary disabled:opacity-50"
            >
              {rotatingKey === key.apiKey ? 'Rotating…' : 'Rotate Secret'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
