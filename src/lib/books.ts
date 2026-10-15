import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Book = Database["public"]["Tables"]["books"]["Row"];

export const booksQuery = queryOptions({
  queryKey: ["books"],
  queryFn: async () => {
    const { data, error } = await supabase.from("books").select("*").order("title");
    if (error) throw error;
    return data;
  },
});

export const isPhysical = (b: Book) => b.format === "physical" || b.format === "both";
export const isDigital = (b: Book) => (b.format === "digital" || b.format === "both") && !!b.file_path;
export const formatLabel = (f: string) =>
  f === "both" ? "Print & digital" : f === "digital" ? "Digital" : "Print";

export async function openEbook(path: string) {
  const { data, error } = await supabase.storage.from("ebooks").createSignedUrl(path, 3600);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}
