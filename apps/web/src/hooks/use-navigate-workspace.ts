import { useCallback } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
  type NavigateOptions,
} from "react-router";

const joinPaths = (org: string, project: string, path: string) => {
  const withoutStartingSlash = path.startsWith("/") ? path.slice(1) : path;

  return `/${[org, project, withoutStartingSlash].filter(Boolean).join("/")}`;
};

export const useNavigateWorkspace = () => {
  const navigate = useNavigate();
  const { org, project = "default" } = useParams();

  const navigateWorkspace = useCallback(
    (path: string, options?: NavigateOptions) =>
      navigate(joinPaths(org!, project, path), options),
    [navigate, org, project],
  );

  return navigateWorkspace;
};

export const useNavigateOrg = () => {
  const navigate = useNavigate();
  const { org } = useParams();

  const navigateOrg = useCallback(
    (path: string) =>
      navigate(`/${org}/${path.startsWith("/") ? path.slice(1) : path}`),
    [navigate, org],
  );

  return navigateOrg;
};

export const useOrgLink = () => {
  const { org } = useParams();

  const getLinkFor = useCallback(
    (path: string) => `/${org}/${path.startsWith("/") ? path.slice(1) : path}`,
    [org],
  );

  return getLinkFor;
};

export const useWorkspaceLink = () => {
  const { org: _org, project = "default" } = useParams();
  const [searchParams] = useSearchParams();
  const org = _org ?? searchParams.get("workspace_hint");

  const getLinkFor = useCallback(
    (path: string) => joinPaths(org!, project, path),
    [org, project],
  );

  return getLinkFor;
};
