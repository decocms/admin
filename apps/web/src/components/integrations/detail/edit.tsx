import { type Integration, IntegrationSchema, useIntegration } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router";
import { DockedPageLayout, DockedToggleButton } from "../../pageLayout.tsx";
import { Context } from "./context.ts";
import { DetailForm } from "./form.tsx";
import { Inspector } from "./inspector.tsx";

const MAIN = {
  header: Header,
  main: DetailForm,
};

const TABS = {
  inspector: {
    Component: Inspector,
    initialOpen: true,
    title: "Inspect",
  },
};

function Header() {
  return (
    <>
      <div>
        <Button asChild variant="ghost" onClick={() => {}}>
          <Link to="/integrations">
            <Icon name="arrow_back" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <DockedToggleButton
          id="inspector"
          title="Inspector"
          variant="outline"
          size="icon"
        >
          <Icon name="frame_inspect" />
        </DockedToggleButton>
      </div>
    </>
  );
}

export default function Edit() {
  const { id } = useParams();
  const { data: integration } = useIntegration(id!);

  const form = useForm<Integration>({
    resolver: zodResolver(IntegrationSchema),
    defaultValues: {
      id: integration.id || crypto.randomUUID(),
      name: integration.name || "",
      description: integration.description || "",
      icon: integration.icon || "",
      connection: integration.connection || {
        type: "HTTP" as const,
        url: "https://example.com/sse",
        token: "",
      },
    },
  });

  return (
    <Context.Provider value={{ form, integration }}>
      <DockedPageLayout main={MAIN} tabs={TABS} />
    </Context.Provider>
  );
}
