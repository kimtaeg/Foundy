import { login, logoutServer, signup } from "@/lib/api/auth";
import { getApiIdentity, loadSession, readApiIdentity, rememberApiIdentity, startDemoSession, type ApiSession } from "@/lib/api/foundy-api";
import type { ApiIdentity } from "@/lib/api/types";
import type { SignInCredentials, SignUpCredentials } from "@/types/auth";

export async function readServerIdentity(session: ApiSession, supplied?: ApiIdentity) {
  const me = supplied
    ? rememberApiIdentity(session.token, supplied)
    : getApiIdentity(session.token) ?? await readApiIdentity(session.token);
  return {
    session: { ...session, storeId: me.store_id },
    setup: me.setup,
    user: me.user,
    name: me.user.name,
    provider: me.user.provider,
    storeName: me.store_name,
    storeOpening: me.store_opening,
    uid: session.kind === "demo" ? "demo" : `local:${me.user.user_id}`,
  };
}

export async function signInWithServer(credentials: SignInCredentials) {
  let identity: ApiIdentity | undefined;
  let session: ApiSession | null;
  if (credentials.username === "demo" && credentials.password === "demo") {
    session = await startDemoSession();
  } else {
    identity = await login(credentials);
    session = loadSession("account");
  }
  return completeServerSignIn(session, identity);
}

export async function signUpWithServer(credentials: SignUpCredentials) {
  const identity = await signup(credentials);
  return completeServerSignIn(loadSession("account"), identity);
}

async function completeServerSignIn(session: ApiSession | null, identity?: ApiIdentity) {
  if (!session) throw new Error("로그인 세션을 저장할 수 없어요.");
  try {
    return await readServerIdentity(session, identity);
  } catch (error) {
    if (loadSession()?.token === session.token) await logoutServer();
    throw error;
  }
}
