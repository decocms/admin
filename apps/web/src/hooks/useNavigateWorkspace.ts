import { useCallback } from "react";
import { useNavigate, useParams } from "react-router";

export const useNavigateWorkspace = () => {
  const navigate = useNavigate();
  const { teamSlug } = useParams();

  const navigateWorkspace = useCallback(
    (path: string) => {
      const base = teamSlug ? `${teamSlug}` : "";
      const withoutStartingSlash = path.startsWith("/") ? path.slice(1) : path;

      navigate(`/${base}/${withoutStartingSlash}`);
    },
    [navigate, teamSlug],
  );

  return navigateWorkspace;
};
