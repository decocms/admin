import { type User as SupaUser } from "@supabase/supabase-js";
import { type User } from "@deco/sdk";

export const enrichUser = (user: SupaUser) => {
  const metadata = getUserMetadata(user);

  return { ...user, metadata };
};

const getUserMetadata = (
  user: SupaUser,
): User["metadata"] => {
  return {
    full_name: user.user_metadata.full_name,
    avatar_url: user.user_metadata.avatar_url,
    username: generateUsername(user.user_metadata.full_name),
  };
};

const generateUsername = (fullName: string) => {
  const username = `${
    fullName.toLocaleLowerCase().normalize("NFD").replace(
      /[\u0300-\u036f]/g,
      "",
    ).replace(/\s+/g, "-").replace(/[^\w-]/g, "")
  }${Date.now().toString(36)}`;

  return username;
};
