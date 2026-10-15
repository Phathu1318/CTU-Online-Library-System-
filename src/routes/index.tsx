import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import heroImg from "@/assets/library-hero.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookCover } from "@/components/BookCover";
import { booksQuery, formatLabel, isDigital, isPhysical } from "@/lib/books";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CTU Online Library — A world of learning, within reach" },
      { name: "description", content: "Search the CTU catalogue, borrow print books and read digital resources online." },
      { property: "og:title", content: "CTU Online Library" },
      { property: "og:description", content: "Search the CTU catalogue, borrow print books and read digital resources online." },
    ],
  }),
  component: Index,
});

type FormatFilter = "all" | "physical" | "digital";

function Index() {
  const { user } = useAuth();
  const books = useQuery(booksQuery);
  const mine = useQuery({
    queryKey: ["my-counts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [l, s] = await Promise.all([
        supabase.from("loans").select("id", { count: "exact", head: true }).eq("user_id", user!.id).is("returned_at", null),
        supabase.from("saved_books").select("book_id", { count: "exact", head: true }).eq("user_id", user!.id),
      ]);
      return { loans: l.count ?? 0, saved: s.count ?? 0 };
    },
  });

  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("all");
  const [format, setFormat] = useState<FormatFilter>("all");

  const list = books.data ?? [];
  const subjects = useMemo(() => Array.from(new Set(list.map((b) => b.subject))).sort(), [list]);
  const filtered = list.filter((b) => {
    const t = q.toLowerCase();
    if (t && !`${b.title} ${b.author} ${b.subject}`.toLowerCase().includes(t)) return false;
    if (subject !== "all" && b.subject !== subject) return false;
    if (format === "physical" && !(isPhysical(b) && b.available_copies > 0)) return false;
    if (format === "digital" && !(b.format === "digital" || b.format === "both")) return false;
    return true;
  });

  const stats = [
    { n: list.length, l: "Books in catalogue" },
    { n: list.filter((b) => b.format !== "physical").length, l: "Digital resources" },
    { n: mine.data?.loans ?? 0, l: "Your active loans" },
    { n: mine.data?.saved ?? 0, l: "Your saved books" },
  ];

  return (
    <main>
      <section className="relative overflow-hidden bg-hero text-hero-foreground">
        <img src={heroImg} alt="" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-hero via-hero/80 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 md:py-32">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Your next chapter</p>
          <h1 className="mt-4 max-w-2xl text-5xl leading-[1.05] md:text-7xl">A world of learning, within reach.</h1>
          <p className="mt-6 max-w-lg text-lg opacity-85">Find the right resources for your studies, projects, and ideas.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="hero" size="lg" asChild><a href="#catalogue">Explore the catalogue</a></Button>
            {!user && <Button variant="heroOutline" size="lg" asChild><Link to="/auth">Student & staff portal</Link></Button>}
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-10 grid max-w-6xl grid-cols-2 gap-3 px-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l} className="relative rounded-xl border bg-card p-5 shadow-sm">
            <div className="font-display text-4xl text-primary">{s.n}</div>
            <div className="mt-1 text-sm text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </section>

      <section id="catalogue" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-20">
        <h2 className="text-4xl">Browse the collection</h2>
        <p className="mt-2 text-muted-foreground">Find something that moves your learning forward.</p>

        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, author or subject" className="h-11 pl-9" />
          </div>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className="h-11 rounded-md border bg-card px-3 text-sm">
            <option value="all">All subjects</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex rounded-full border bg-card p-1">
            {(["all", "physical", "digital"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={cn("rounded-full px-4 py-1.5 text-sm transition-colors", format === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {f === "all" ? "All formats" : f === "physical" ? "Print available" : "Digital"}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">{filtered.length} books</p>

        {books.isLoading ? (
          <p className="py-16 text-center text-muted-foreground">Loading the collection…</p>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <h3 className="text-2xl">No books match</h3>
            <p className="mt-2 text-muted-foreground">Try a different search or filter.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((b) => (
              <Link key={b.id} to="/books/$id" params={{ id: b.id }} className="group">
                <BookCover title={b.title} author={b.author} color={b.cover_color} className="transition-transform group-hover:-translate-y-1" />
                <div className="mt-3 text-sm font-semibold leading-snug group-hover:text-primary">{b.title}</div>
                <div className="text-xs text-muted-foreground">{b.author}</div>
                <div className="mt-1 text-xs">
                  <span className="text-muted-foreground">{formatLabel(b.format)}</span>
                  {isPhysical(b) && (
                    <span className={cn("ml-2", b.available_copies > 0 ? "text-success" : "text-destructive")}>
                      · {b.available_copies > 0 ? `${b.available_copies} available` : "All on loan"}
                    </span>
                  )}
                  {isDigital(b) && <span className="ml-2 text-success">· Read online</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
