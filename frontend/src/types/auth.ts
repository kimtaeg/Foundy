export interface SignInCredentials {
  username: string;
  password: string;
}

export interface SignUpCredentials extends SignInCredentials {
  name: string;
}

export type SignUpHandler = (credentials: SignUpCredentials) => Promise<void> | void;

/** The view owns form state; the caller supplies authentication behavior. */
export type SignInHandler = (
  credentials: SignInCredentials,
) => Promise<void> | void;
