import { usePrompts } from "@deco/sdk";
import { DocumentsResourceList } from "./documents-resource-list.tsx";
import { DocumentsTabs } from "./tabs-nav.tsx";

export default function DocumentsListPage() {
  // it is being used to not pollute the screen for new users
  // as soon as no one uses the old prompts anymore, we can remove it
  // to not fetch it unnecessarily
  const { data: legacyPrompts } = usePrompts();
  const hideLegacy = legacyPrompts?.length <= 2;
  return (
    <DocumentsResourceList
      headerSlot={hideLegacy ? undefined : <DocumentsTabs active="documents" />}
    />
  );
}
