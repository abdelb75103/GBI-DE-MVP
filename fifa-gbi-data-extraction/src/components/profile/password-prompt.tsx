'use client';

import { useState, useRef, useEffect } from 'react';

type PasswordPromptProps = {
  profileName: string;
  profileId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
};

export function PasswordPrompt({
  profileName,
  profileId,
  isOpen,
  onClose,
  onSuccess,
}: PasswordPromptProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Focus input when modal opens
      inputRef.current.focus();
    }
    
    // Reset state when modal closes
    if (!isOpen) {
      // Use setTimeout to avoid calling setState synchronously in effect
      const timer = setTimeout(() => {
        setPassword('');
        setError(null);
        setIsVerifying(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    setIsVerifying(true);

    try {
      const response = await fetch('/api/profiles/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid password. Please try again.');
        setIsVerifying(false);
        // Refocus input on error
        inputRef.current?.focus();
        return;
      }

      // Password verified successfully
      setPassword('');
      await onSuccess();
      setIsVerifying(false);
    } catch (err) {
      console.error('[PasswordPrompt] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to verify password. Please try again.');
      setIsVerifying(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden rounded-3xl bg-[#0b3a70]/12 p-4 backdrop-blur-[6px] sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-prompt-title"
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-white/80 bg-white/92 p-5 shadow-2xl shadow-[#0b3a70]/18 ring-1 ring-[#b8ddf7]/50 backdrop-blur-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <h2
            id="password-prompt-title"
            className="text-xl font-semibold text-slate-900"
          >
            Enter Password
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Please enter the password for <strong>{profileName}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password-input"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              ref={inputRef}
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isVerifying}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-[#0b3a70] focus:outline-none focus:ring-2 focus:ring-[#0b3a70]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isVerifying}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0b3a70]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying || !password.trim()}
              className="flex-1 rounded-lg bg-[#0b3a70] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#082f5f] focus:outline-none focus:ring-2 focus:ring-[#0b3a70]/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isVerifying ? 'Verifying...' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
