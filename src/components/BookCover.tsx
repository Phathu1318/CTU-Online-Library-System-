import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  forest: "bg-cover-forest",
  clay: "bg-cover-clay",
  ink: "bg-cover-ink",
  ochre: "bg-cover-ochre",
};

export function BookCover({ title, author, color, className }: { title: string; author: string; color: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-r-md rounded-l-sm p-4 text-cover-foreground shadow-book",
        tones[color] ?? "bg-cover-forest",
        className,
      )}
    >
      <div className="absolute inset-y-0 left-0 w-2 bg-foreground/15" />
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-70">CTU Library</div>
      <div>
        <div className="font-display text-lg leading-tight">{title}</div>
        <div className="mt-2 text-xs opacity-80">{author}</div>
      </div>
    </div>
  );
}
