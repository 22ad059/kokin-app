'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        window.location.href = '/';
        return;
      }
      setError('合言葉が違います');
    } catch {
      setError('通信に失敗しました。もう一度お試しください');
    }
    setLoading(false);
  }

  return (
    <main className="flex-1 flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4"
      >
        <h1 className="text-2xl font-bold text-slate-800 text-center tracking-wide">
          英語・デ・古今東西ゲーム
        </h1>
        <label htmlFor="passcode" className="text-sm text-slate-600 text-center">
          合言葉を入力してください
        </label>
        <input
          id="passcode"
          type="password"
          autoFocus
          autoComplete="off"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {error && (
          <p role="alert" className="text-sm text-red-600 text-center">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !passcode.trim()}
          className="w-full rounded-lg bg-indigo-600 text-white font-bold py-3 disabled:opacity-50 hover:bg-indigo-700 transition-colors"
        >
          {loading ? '確認中…' : 'はじめる'}
        </button>
      </form>
    </main>
  );
}
