import test from "node:test";
import assert from "node:assert/strict";
import {
  createAuth0Actions,
  previewAuthActions,
} from "../auth/auth0Actions.js";

test("Auth0 login forwards an email hint, never a password", async () => {
  const calls = [];
  const auth = createAuth0Actions(async (options) => calls.push(options));
  await auth.login({
    email: "neighbor@example.com",
    password: "must-not-be-forwarded",
  });
  assert.deepEqual(calls, [
    {
      appState: { returnTo: "/" },
      authorizationParams: { login_hint: "neighbor@example.com" },
    },
  ]);
});
test("Google, signup, and reset are delegated to hosted Auth0 flows", async () => {
  const calls = [];
  const auth = createAuth0Actions(async (options) =>
    calls.push(options.authorizationParams),
  );
  await auth.google();
  await auth.signup();
  await auth.resetPassword({ email: "neighbor@example.com" });
  assert.deepEqual(calls, [
    { connection: "google-oauth2" },
    { screen_hint: "signup" },
    { prompt: "login", login_hint: "neighbor@example.com" },
  ]);
});
test("unconnected authentication never reports success", async () => {
  for (const action of ["login", "google", "signup", "resetPassword"])
    await assert.rejects(previewAuthActions[action](), /not connected/);
});
