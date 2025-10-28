import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KEYS, registerProjectActivity } from "@deco/sdk";

export const useRegisterActivity = (org?: string, project?: string) => {
  const client = useQueryClient();

  useEffect(() => {
    if (!org || !project) return;
    registerProjectActivity(org, project)
      .then(() => {
        client.invalidateQueries({ queryKey: KEYS.RECENT_PROJECTS() });
      })
      .catch((err) => {
        console.error("Failed to register project activity", err);
      });
  }, [org, project]);
};
