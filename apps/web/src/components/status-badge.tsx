import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";
const tones: Record<Tone, string> = {
  success: "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20 dark:bg-[#22C55E]/15 dark:text-[#22c55e] dark:border-[#22C55E]/25",
  warning: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 dark:bg-[#F59E0B]/15 dark:text-[#f59e0b] dark:border-[#F59E0B]/25",
  danger: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20 dark:bg-[#EF4444]/15 dark:text-[#ef4444] dark:border-[#EF4444]/25",
  info: "bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20 dark:bg-[#3B82F6]/15 dark:text-[#3b82f6] dark:border-[#3B82F6]/25",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
