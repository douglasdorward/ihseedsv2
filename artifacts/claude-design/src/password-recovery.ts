type CompletedSignIn = {
  status: string | null;
  createdSessionId: string | null;
};

type RecoveryDependencies = {
  password: string;
  providerCompleted: boolean;
  resetPassword: (params: {
    password: string;
    signOutOfOtherSessions: boolean;
  }) => Promise<CompletedSignIn>;
  setActive: (params: { session: string }) => Promise<void>;
  onProviderCompleted: () => void;
  reconcile: () => Promise<void>;
};

/**
 * Completes the provider reset once, then reconciles the application ledger.
 * If reconciliation fails, providerCompleted remains true in the caller so a
 * retry cannot submit the new password to Clerk a second time.
 */
export async function completePasswordRecovery({
  password,
  providerCompleted,
  resetPassword,
  setActive,
  onProviderCompleted,
  reconcile,
}: RecoveryDependencies) {
  if (!providerCompleted) {
    const result = await resetPassword({
      password,
      signOutOfOtherSessions: true,
    });
    if (result.status !== "complete" || !result.createdSessionId) {
      throw new Error("Password recovery did not complete. Please try again.");
    }
    await setActive({ session: result.createdSessionId });
    onProviderCompleted();
  }
  await reconcile();
}