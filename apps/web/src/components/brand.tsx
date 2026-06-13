import { Code2 } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative grid h-8 w-8 place-items-center rounded-lg gradient-brand shadow-[0_4px_20px_-4px_rgba(59,130,246,0.5)]">
        <Code2 className="h-4 w-4 text-white" strokeWidth={2.5} />
      </div>
      <span className="text-base font-semibold tracking-tight">AssessCode</span>
    </div>
  );
}
