import { fetchUser, type User } from '@deco/sdk';
import { use } from 'react';

const promise = fetchUser();

export const onUserChange = (callback: (user: User) => void) =>
  promise.then((user) => callback(user));

export const useUser = () => use(promise);
