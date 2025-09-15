import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { registerProjectActivity } from "@deco/sdk";

export const useRegisterActivity = (org?: string, project?: string) => {
  const client = useQueryClient();

  useEffect(() => {
    if (!org || !project) return;
    registerProjectActivity(org, project)
      .then(() => {
        client.invalidateQueries({ queryKey: ["recent-projects"] });
      })
      .catch((err) => {
        console.error("Failed to register project activity", err);
      });
  }, [org, project]);
};
