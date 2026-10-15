import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/BookCover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/my-library")({
  head: () => ({
    meta: [
      { title: "My library — CTU Online Library" },
      { name: "description", content: "Your loans, due dates and saved books." },
      { property: "og:title", content: "My library — CTU Online Library" },
      { property: "og:description", content: "Your loans, due dates and saved books." },
    ],
  }),
  component: MyLibrary,
});

function MyLibrary() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const loans = useQuery({
    queryKey: ["my-loans", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("loans").select("id, borrowed_at, due_at, returned_at, books(id, title, author, cover_color)").eq("user_id", user!.id).order("borrowed_at", { ascending: false })).data ?? [],
  });
  const saved = useQuery({
    queryKey: ["my-saved", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("saved_books").select("book_id, books(id, title, author, cover_color)").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const giveBack = useMutation({
    mutationFn: async (loanId: string) => {
      const { error } = await supabase.rpc("return_book", { _loan_id: loanId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Returned. Thank you!"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = (loans.data ?? []).filter((l) => !l.returned_at);
  const past = (loans.data ?? []).filter((l) => l.returned_at);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-4xl">My library</h1>
      <p className="mt-1 text-muted-foreground">{user?.email}</p>

      <h2 className="mt-10 text-2xl">On loan ({active.length})</h2>
      {active.length === 0 ? (
        <p className="mt-3 text-muted-foreground">No books on loan. <Link to="/" className="text-primary underline">Browse the catalogue</Link></p>
      ) : (
        <ul className="mt-4 divide-y rounded-xl border bg-card">
          {active.map((l) => {
            const overdue = new Date(l.due_at) < new Date();
            return (
              <li key={l.id} className="flex items-center gap-4 p-4">
                <div className="w-12 shrink-0"><BookCover title="" author="" color={l.books?.cover_color ?? "forest"} className="p-1" /></div>
                <div className="flex-1">
                  <Link to="/books/$id" params={{ id: l.books!.id }} className="font-semibold hover:text-primary">{l.books?.title}</Link>
                  <div className={overdue ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                    {overdue ? "Overdue since" : "Due"} {new Date(l.due_at).toLocaleDateString()}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => giveBack.mutate(l.id)}>Return</Button>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-12 text-2xl">Saved books ({saved.data?.length ?? 0})</h2>
      <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {(saved.data ?? []).map((s) => s.books && (
          <Link key={s.book_id} to="/books/$id" params={{ id: s.books.id }}>
            <BookCover title={s.books.title} author={s.books.author} color={s.books.cover_color} />
          </Link>
        ))}
      </div>
      {saved.data?.length === 0 && <p className="text-muted-foreground">Tap “Save” on any book to keep it here.</p>}

      {past.length > 0 && (
        <>
          <h2 className="mt-12 text-2xl">Borrowing history</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {past.map((l) => <li key={l.id}>{l.books?.title} — returned {new Date(l.returned_at!).toLocaleDateString()}</li>)}
          </ul>
        </>
      )}
    </main>
  );
}
