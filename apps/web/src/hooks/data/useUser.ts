import { use } from "react";
import { fetchUser, User } from "@deco/sdk";

const promise = fetchUser();

export const onUserChange = (callback: (user: User) => void) =>
  promise.then((user) => callback(user));

export const useUser = () => use(promise);

export { NotLoggedInError } from "@deco/sdk";
