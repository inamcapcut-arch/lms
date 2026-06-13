'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://127.0.0.1:3001/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to login');
      }

      const isProd = process.env.NODE_ENV === 'production';
      Cookies.set('token', data.accessToken, { secure: isProd, sameSite: 'strict' });
      Cookies.set('accessToken', data.accessToken, { secure: isProd, sameSite: 'strict' });
      Cookies.set('role', data.user.role, { secure: isProd, sameSite: 'strict' });

      if (data.user.role === 'ADMIN') {
        router.push('/admin');
      } else if (data.user.role === 'TRAINER') {
        router.push('/trainer');
      } else {
        router.push('/student');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="glass relative z-10 w-full max-w-md rounded-2xl p-8 shadow-2xl"
    >
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to continue to AssessCode.</p>

      <form onSubmit={handleLogin} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email" className="text-xs text-muted-foreground">
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            placeholder="m@example.com"
            className={`mt-1.5 h-10 ${
              error ? 'border-destructive focus-visible:ring-destructive' : ''
            }`}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs text-muted-foreground">
              Password
            </Label>
            <a href="#" className="text-xs text-primary hover:underline">
              Forgot password?
            </a>
          </div>
          <div className="relative mt-1.5">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="••••••••"
              className={`h-10 pr-10 ${
                error ? 'border-destructive focus-visible:ring-destructive' : ''
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-destructive mt-2"
          >
            {error}
          </motion.div>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          className="h-10 w-full gradient-brand text-white border-0 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] cursor-pointer mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight className="ml-1.5 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-muted-foreground">
        New to AssessCode?{' '}
        <a href="#" className="text-primary hover:underline">
          Request access
        </a>
      </div>
    </motion.div>
  );
}

