import { useSignIn } from "@clerk/react/legacy";
import { useSignIn as useModernSignIn } from "@clerk/react";

type LoadedSignIn = Extract<ReturnType<typeof useSignIn>, { isLoaded: true }>;
type SignInCreateParams = Parameters<LoadedSignIn["signIn"]["create"]>[0];

declare const identifier: string;
declare const password: string;

const passwordSignIn: SignInCreateParams = {
  strategy: "password",
  identifier,
  password,
};

void passwordSignIn;

type ModernCreateParams = Parameters<
  ReturnType<typeof useModernSignIn>["signIn"]["create"]
>[0];

// The modern signal hook does not accept the legacy password strategy. Keep
// this expectation so changing App.tsx back to the root hook cannot compile.
// @ts-expect-error password is only valid through the legacy custom-flow hook
const modernPasswordSignIn: ModernCreateParams = passwordSignIn;

void modernPasswordSignIn;