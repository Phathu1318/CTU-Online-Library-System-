<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Borrow/return go through the `borrow_book` / `return_book` database functions — keeps copy counts and loan limits atomic and server-enforced.
- Staff permissions come from `public.user_roles` + `has_role()`; the first account to sign up becomes staff — roles must never live on user-editable data.
- Digital files live in the private `ebooks` bucket and are opened via short-lived signed URLs — only signed-in users may read them.
