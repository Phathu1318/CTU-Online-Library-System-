import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { booksQuery, type Book } from "@/lib/books";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff desk — CTU Online Library" },
      { name: "description", content: "Manage the CTU library catalogue and loans." },
      { property: "og:title", content: "Staff desk — CTU Online Library" },
      { property: "og:description", content: "Manage the CTU library catalogue and loans." },
    ],
  }),
  component: StaffPage,
});

type Draft = {
  id?: string; title: string; author: string; subject: string; description: string;
  published_year: string; format: string; total_copies: string; cover_color: string; file_path: string | null;
};
const empty: Draft = { title: "", author: "", subject: "General", description: "", published_year: "", format: "physical", total_copies: "1", cover_color: "forest", file_path: null };

function StaffPage() {
  const { isStaff, user } = useAuth();
  const qc = useQueryClient();
  const books = useQuery(booksQuery);
  const loans = useQuery({
    queryKey: ["all-loans"],
    enabled: isStaff,
    queryFn: async () => (await supabase.from("loans").select("id, user_id, due_at, books(title)").is("returned_at", null).order("due_at")).data ?? [],
  });
  const [draft, setDraft] = useState<Draft>(empty);
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      let file_path = draft.file_path;
      if (file) {
        const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("ebooks").upload(path, file);
        if (error) throw error;
        file_path = path;
      }
      const total = Math.max(0, parseInt(draft.total_copies) || 0);
      const row = {
        title: draft.title, author: draft.author, subject: draft.subject, description: draft.description,
        published_year: draft.published_year ? parseInt(draft.published_year) : null,
        format: draft.format, total_copies: total, cover_color: draft.cover_color, file_path,
      };
      if (draft.id) {
        const prev = books.data?.find((b) => b.id === draft.id);
        const onLoan = prev ? prev.total_copies - prev.available_copies : 0;
        const { error } = await supabase.from("books").update({ ...row, available_copies: Math.max(0, total - onLoan) }).eq("id", draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("books").insert({ ...row, available_copies: total });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); setDraft(empty); setFile(null); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("books").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries(); },
  });
  const giveBack = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("return_book", { _loan_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked as returned"); qc.invalidateQueries(); },
  });

  if (!user) return null;
  if (!isStaff) return <main className="py-24 text-center"><h1 className="text-3xl">Staff only</h1><p className="mt-2 text-muted-foreground">This area is for library staff.</p></main>;

  const edit = (b: Book) => setDraft({
    id: b.id, title: b.title, author: b.author, subject: b.subject, description: b.description,
    published_year: b.published_year?.toString() ?? "", format: b.format, total_copies: b.total_copies.toString(),
    cover_color: b.cover_color, file_path: b.file_path,
  });
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft({ ...draft, [k]: e.target.value });
  const sel = "h-9 w-full rounded-md border bg-card px-3 text-sm";

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl">Staff desk</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[380px_1fr]">
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="h-fit space-y-3 rounded-xl border bg-card p-5">
          <h2 className="text-xl">{draft.id ? "Edit book" : "Add a book"}</h2>
          <div><Label>Title</Label><Input required value={draft.title} onChange={set("title")} /></div>
          <div><Label>Author</Label><Input required value={draft.author} onChange={set("author")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Subject</Label><Input value={draft.subject} onChange={set("subject")} /></div>
            <div><Label>Year</Label><Input type="number" value={draft.published_year} onChange={set("published_year")} /></div>
          </div>
          <div><Label>Description</Label><Textarea value={draft.description} onChange={set("description")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Format</Label>
              <select className={sel} value={draft.format} onChange={set("format")}>
                <option value="physical">Print</option><option value="digital">Digital</option><option value="both">Print & digital</option>
              </select>
            </div>
            <div><Label>Print copies</Label><Input type="number" min={0} value={draft.total_copies} onChange={set("total_copies")} /></div>
          </div>
          <div><Label>Cover colour</Label>
            <select className={sel} value={draft.cover_color} onChange={set("cover_color")}>
              <option value="forest">Forest</option><option value="clay">Clay</option><option value="ink">Ink</option><option value="ochre">Ochre</option>
            </select>
          </div>
          {draft.format !== "physical" && (
            <div>
              <Label>Digital file (PDF)</Label>
              <Input type="file" accept="application/pdf,.epub" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {draft.file_path && !file && <p className="mt-1 text-xs text-muted-foreground">A file is already attached.</p>}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
            {draft.id && <Button type="button" variant="ghost" onClick={() => setDraft(empty)}>Cancel</Button>}
          </div>
        </form>

        <div className="space-y-10">
          <section>
            <h2 className="text-xl">Books on loan ({loans.data?.length ?? 0})</h2>
            <ul className="mt-3 divide-y rounded-xl border bg-card text-sm">
              {(loans.data ?? []).map((l) => (
                <li key={l.id} className="flex items-center justify-between p-3">
                  <span>{l.books?.title} <span className={new Date(l.due_at) < new Date() ? "text-destructive" : "text-muted-foreground"}>· due {new Date(l.due_at).toLocaleDateString()}</span></span>
                  <Button size="sm" variant="outline" onClick={() => giveBack.mutate(l.id)}>Mark returned</Button>
                </li>
              ))}
              {loans.data?.length === 0 && <li className="p-3 text-muted-foreground">Nothing on loan.</li>}
            </ul>
          </section>
          <section>
            <h2 className="text-xl">Catalogue ({books.data?.length ?? 0})</h2>
            <ul className="mt-3 divide-y rounded-xl border bg-card text-sm">
              {(books.data ?? []).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <div className="font-medium">{b.title}</div>
                    <div className="text-muted-foreground">{b.author} · {b.available_copies}/{b.total_copies} print{b.file_path ? " · has file" : ""}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => edit(b)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm(`Delete "${b.title}"?`) && remove.mutate(b.id)}>Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
