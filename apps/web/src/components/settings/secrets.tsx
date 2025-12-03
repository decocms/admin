import {
  useCreateSecret,
  useDeleteSecret,
  useSecrets,
  useUpdateSecret,
  type CreateSecretInput,
  type UpdateSecretInput,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import {
  Table,
  type TableColumn,
} from "@deco/ui/components/collection-table.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { createContext, Suspense, useContext, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface Secret {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

function Header() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight">
          Project Secrets
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Securely store and manage encrypted API keys and credentials for your
          project
        </p>
      </div>
    </div>
  );
}

const Context = createContext<{
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
});

const useModal = () => useContext(Context);

const ModalContext = ({
  children,
  isOpen,
  setIsOpen,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) => {
  return (
    <Context.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </Context.Provider>
  );
};

const ActionsCell = ({
  onEditClick,
  onDeleteClick,
}: {
  secret: Secret;
  onEditClick: () => void;
  onDeleteClick: () => void;
}) => {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Icon name="more_vert" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onEditClick();
          }}
        >
          <Icon name="edit" className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick();
          }}
        >
          <Icon name="delete" className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const SecretInfoCell = ({ secret }: { secret: Secret }) => {
  return (
    <div className="flex items-center gap-2">
      <Icon name="key" className="text-muted-foreground" />
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-medium line-clamp-1">{secret.name}</h3>
        </div>
        {secret.description && (
          <p className="text-sm text-muted-foreground">{secret.description}</p>
        )}
      </div>
    </div>
  );
};

const secretFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .regex(
      /^[A-Z0-9_]+$/,
      "Name must be uppercase alphanumeric with underscores only",
    ),
  value: z.string().min(1, "Value is required"),
  description: z.string().optional(),
});

type SecretForm = z.infer<typeof secretFormSchema>;

function TableView({ secrets }: { secrets: Secret[] }) {
  const { isOpen: modalOpen, setIsOpen } = useModal();
  const secretRef = useRef<Secret | undefined>(undefined);

  const modalForm = useForm<SecretForm>({
    resolver: zodResolver(secretFormSchema),
  });
  const updateSecret = useUpdateSecret();
  const createSecret = useCreateSecret();
  const deleteSecret = useDeleteSecret();

  const isMutating = updateSecret.isPending || createSecret.isPending;

  async function handleSecretDelete(secret: Secret) {
    try {
      await deleteSecret.mutateAsync(secret.id);
      toast.success("Secret deleted successfully");
    } catch (error) {
      toast.error("Failed to delete secret");
      console.error(error);
    }
  }

  const columns: TableColumn<Secret>[] = [
    {
      id: "name",
      header: "Name",
      accessor: (secret) => <SecretInfoCell secret={secret} />,
    },
    {
      id: "value",
      header: "Value",
      accessor: () => <span className="text-muted-foreground">••••••••</span>,
    },
    {
      id: "actions",
      header: "",
      accessor: (secret) => (
        <ActionsCell
          secret={secret}
          onEditClick={() => {
            secretRef.current = secret;
            modalForm.reset({
              name: secret.name,
              value: "",
              description: secret.description || "",
            });
            setIsOpen(true);
          }}
          onDeleteClick={() => handleSecretDelete(secret)}
        />
      ),
    },
  ];

  async function onSubmit(data: SecretForm) {
    try {
      if (secretRef.current) {
        // Update existing secret
        const updateData: UpdateSecretInput = {
          id: secretRef.current.id,
          data: {
            description: data.description,
          },
        };

        // Only update value if it's provided
        if (data.value) {
          updateData.data.value = data.value;
        }

        await updateSecret.mutateAsync(updateData);
        toast.success("Secret updated successfully");
      } else {
        // Create new secret
        const createData: CreateSecretInput = {
          name: data.name,
          value: data.value,
          description: data.description,
        };
        await createSecret.mutateAsync(createData);
        toast.success("Secret created successfully");
      }
      setIsOpen(false);
      modalForm.reset();
      secretRef.current = undefined;
    } catch (error) {
      toast.error(
        secretRef.current
          ? "Failed to update secret"
          : "Failed to create secret",
      );
      console.error(error);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end mb-6">
        <Button
          onClick={() => {
            secretRef.current = undefined;
            modalForm.reset({
              name: "",
              value: "",
              description: "",
            });
            setIsOpen(true);
          }}
        >
          <Icon name="add" className="mr-2" />
          Add Secret
        </Button>
      </div>

      {secrets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Icon name="key" className="text-muted-foreground" size={24} />
          </div>
          <h3 className="text-lg font-medium mb-2">No secrets yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Add your first secret to securely store API keys and credentials for
            your project
          </p>
        </div>
      ) : (
        <Table data={secrets} columns={columns} />
      )}

      <Dialog open={modalOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {secretRef.current ? "Edit Secret" : "Add Secret"}
            </DialogTitle>
            <DialogDescription>
              {secretRef.current
                ? "Update the secret value or description"
                : "Create a new encrypted secret for your project"}
            </DialogDescription>
          </DialogHeader>

          <Form {...modalForm}>
            <form
              onSubmit={modalForm.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={modalForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="STRIPE_API_KEY"
                        disabled={!!secretRef.current || isMutating}
                      />
                    </FormControl>
                    <FormDescription>
                      Uppercase alphanumeric with underscores only
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={modalForm.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Value{" "}
                      {secretRef.current && "(leave empty to keep current)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter secret value"
                        disabled={isMutating}
                      />
                    </FormControl>
                    <FormDescription>
                      Will be encrypted and stored securely
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={modalForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Description of what this secret is for"
                        disabled={isMutating}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isMutating}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isMutating}>
                  {isMutating
                    ? "Saving..."
                    : secretRef.current
                      ? "Update"
                      : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SecretsInner() {
  const { data: secrets } = useSecrets();
  return <TableView secrets={secrets} />;
}

export default function Secrets() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        {/* Header Section - sticky horizontally */}
        <div className="sticky left-0 px-8 py-6 bg-background border-b border-border">
          <div className="max-w-[1600px] mx-auto w-full">
            <Header />
          </div>
        </div>

        {/* Content Section */}
        <div className="px-8 py-6">
          <div className="max-w-[1600px] mx-auto w-full">
            <ModalContext isOpen={isOpen} setIsOpen={setIsOpen}>
              <Suspense
                fallback={
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                }
              >
                <SecretsInner />
              </Suspense>
            </ModalContext>
          </div>
        </div>
      </div>
    </div>
  );
}
