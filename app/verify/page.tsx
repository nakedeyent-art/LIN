import Link from "next/link";
import { peekVerifyToken } from "@/lib/verification";
import { confirmEmail } from "./actions";

// The link only *shows* a confirm button; the token is consumed on POST so mail scanners that
// prefetch links can't use it up.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const valid = token ? await peekVerifyToken(token) : false;
  return (
    <div className="center">
      <h1>Confirm your email</h1>
      {error && <p role="alert" className="error">{error}</p>}
      {valid ? (
        <form action={confirmEmail}>
          <input type="hidden" name="token" value={token} />
          <button className="btn" type="submit">Confirm email address</button>
        </form>
      ) : (
        !error && <p className="error">This link is invalid, expired or already used. <Link href="/verify-email" style={{ textDecoration: "underline" }}>Request a new one</Link>.</p>
      )}
    </div>
  );
}
