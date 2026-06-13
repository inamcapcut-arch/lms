import { LoginForm } from './login-form';
import { Logo } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4">
      {/* Premium Background Effects */}
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-[#3B82F6]/30 blur-[120px] animate-blob" />
      <div className="pointer-events-none absolute -right-32 bottom-10 h-96 w-96 rounded-full bg-[#6366F1]/30 blur-[120px] animate-blob" style={{ animationDelay: "5s" }} />

      <div className="absolute right-4 top-4 flex items-center gap-2">
        <ThemeToggle />
      </div>
      <Link href="/" className="absolute left-4 top-4">
        <Logo />
      </Link>

      <LoginForm />
    </div>
  );
}

