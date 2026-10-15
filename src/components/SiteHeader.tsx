import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function SiteHeader() {
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const link = "text-sm font-medium text-muted-foreground hover:text-foreground transition-colors";
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
            <BookOpen />
          </span>
          <span className="font-display text-lg font-semibold">CTU Library</span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link to="/" className={link} activeProps={{ className: "text-foreground" }} activeOptions={{ exact: true }}>
            Catalogue
          </Link>
          {user && (
            <Link to="/my-library" className={link} activeProps={{ className: "text-foreground" }}>
              My library
            </Link>
          )}
          {isStaff && (
            <Link to="/staff" className={link} activeProps={{ className: "text-foreground" }}>
              Staff
            </Link>
          )}
          {user ? (
            <Button size="sm" variant="outline" onClick={signOut}>Sign out</Button>
          ) : (
            <Button size="sm" asChild><Link to="/auth">Sign in</Link></Button>
          )}
        </nav>
      </div>
    </header>
  );
}
