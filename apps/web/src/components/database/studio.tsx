import { DECO_CMS_API_URL } from "@deco/sdk";
import { useParams } from "react-router";
import { PreviewIframe } from "../agent/preview.tsx";

export default function DatabaseStudio() {
  const { org, project } = useParams<{ org: string; project: string }>();

  if (!org || !project) {
    return null;
  }

  const studioUrl = `${DECO_CMS_API_URL}/${org}/${project}/i:databases-management/studio`;

  return (
    <div className="h-[calc(100vh-48px)] w-full">
      <PreviewIframe
        src={studioUrl}
        title="Database Studio"
        className="w-full h-full border-0"
      />
    </div>
  );
}
