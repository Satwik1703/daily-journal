import {
  readSessionAndUser,
  refreshSessionIfStale,
  type SessionRow,
  type UserRow,
} from "./session";

export class AuthError extends Error {
  constructor(message = "not authenticated") {
    super(message);
    this.name = "AuthError";
  }
}

export async function getCurrentUser(): Promise<
  { session: SessionRow; user: UserRow } | null
> {
  const row = await readSessionAndUser();
  if (!row) return null;
  await refreshSessionIfStale(row.session);
  return row;
}

export async function requireUser(): Promise<{
  session: SessionRow;
  user: UserRow;
}> {
  const row = await getCurrentUser();
  if (!row) throw new AuthError();
  return row;
}
