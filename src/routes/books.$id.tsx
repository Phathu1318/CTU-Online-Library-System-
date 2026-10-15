import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/BookCover";
import { supabase } from "@/integrations/supabase/client";
import { formatLabel, isDigital, isPhysical, openEbook } from "@/lib/books";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/books/$id")({
  head: () => ({
    meta: [
      { title: "Book details — CTU Online Library" },
      { name: "description", content: "See availability, borrow or read this book from the CTU library." },
      { property: "og:title", content: "Book details — CTU Online Library" },
      { property: "og:description", content: "See availability, borrow or read this book from the CTU library." },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const book = useQuery({
    queryKey: ["book", id],
    queryFn: async () => (await supabase.from("books").select("*").eq("id", id).maybeSingle()).data,
  });
  const status = useQuery({
    queryKey: ["book-status", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [loan, saved] = await Promise.all([
        supabase.from("loans").select("id, due_at").eq("book_id", id).eq("user_id", user!.id).is("returned_at", null).maybeSingle(),
        supabase.from("saved_books").select("book_id").eq("book_id", id).eq("user_id", user!.id).maybeSingle(),
      ]);
      return { loan: loan.data, saved: !!saved.data };
    },
  });

  const refresh = () => qc.invalidateQueries();

  const borrow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("borrow_book", { _book_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Borrowed! Due back in 14 days."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const giveBack = useMutation({
    mutationFn: async (loanId: string) => {
      const { error } = await supabase.rpc("return_book", { _loan_id: loanId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Returned. Thank you!"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleSave = useMutation({
    mutationFn: async () => {
      if (status.data?.saved) await supabase.from("saved_books").delete().eq("book_id", id).eq("user_id", user!.id);
      else await supabase.from("saved_books").insert({ book_id: id, user_id: user!.id });
    },
    onSuccess: refresh,
  });

  const b = book.data;
  if (book.isLoading) return <main className="py-24 text-center text-muted-foreground">Loading…</main>;
  if (!b) return <main className="py-24 text-center"><h1 className="text-3xl">Book not found</h1></main>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to catalogue</Link>
      <div className="mt-8 grid gap-10 md:grid-cols-[260px_1fr]">
        <BookCover title={b.title} author={b.author} color={b.cover_color} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{b.subject}</p>
          <h1 className="mt-2 text-4xl md:text-5xl">{b.title}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{b.author}{b.published_year ? ` · ${b.published_year}` : ""}</p>
          <p className="mt-6 leading-relaxed">{b.description}</p>

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 text-sm">
            <div><dt className="text-muted-foreground">Format</dt><dd className="font-medium">{formatLabel(b.format)}</dd></div>
            {isPhysical(b) && <div><dt className="text-muted-foreground">Print copies</dt><dd className="font-medium">{b.available_copies} of {b.total_copies} available</dd></div>}
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            {!user ? (
              <Button asChild><Link to="/auth">Sign in to borrow or read</Link></Button>
            ) : (
              <>
                {isPhysical(b) && (status.data?.loan ? (
                  <Button variant="secondary" onClick={() => giveBack.mutate(status.data!.loan!.id)} disabled={giveBack.isPending}>
                    Return (due {new Date(status.data.loan.due_at).toLocaleDateString()})
                  </Button>
                ) : (
                  <Button onClick={() => borrow.mutate()} disabled={borrow.isPending || b.available_copies < 1}>
                    {b.available_copies < 1 ? "All copies on loan" : "Borrow this book"}
                  </Button>
                ))}
                {isDigital(b) && (
                  <Button variant="outline" onClick={() => openEbook(b.file_path!).catch((e) => toast.error(e.message))}>Read online</Button>
                )}
                {(b.format === "digital" || b.format === "both") && !b.file_path && (
                  <span className="self-center text-sm text-muted-foreground">Digital copy coming soon</span>
                )}
                <Button variant="ghost" onClick={() => toggleSave.mutate()}>
                  {status.data?.saved ? <><BookmarkCheck /> Saved</> : <><Bookmark /> Save</>}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
