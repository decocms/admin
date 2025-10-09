import { DocumentsResourceList } from "./documents-resource-list.tsx";
import { DocumentsTabs } from "./tabs-nav.tsx";

export default function DocumentsListPage() {
  return (
    <DocumentsResourceList headerSlot={<DocumentsTabs active="documents" />} />
  );
}
