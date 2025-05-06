import * as dropdown from "./dropdown-menu.tsx";
import * as drawer from "./drawer.tsx";
import { useIsMobile } from "../hooks/use-mobile.ts";
import { createContext, useContext } from "react";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { Button } from "./button.tsx";
import { cn } from "../lib/utils.ts";

const ResponsiveDropdownContext = createContext<{
  isMobile: boolean;
  setOpen: (open: boolean) => void;
}>({
  isMobile: false,
  setOpen: () => {},
});
const useResponsiveDropdownContext = () =>
  useContext(ResponsiveDropdownContext);

const ResponsiveDropdown = ({
  children,
  defaultOpen,
  open: openProp,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof dropdown.DropdownMenu>) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
  });

  return (
    <ResponsiveDropdownContext.Provider value={{ isMobile, setOpen }}>
      <dropdown.DropdownMenu open={open} onOpenChange={setOpen} {...props}>
        <drawer.Drawer open={open} onOpenChange={setOpen} {...props}>
          {children}
        </drawer.Drawer>
      </dropdown.DropdownMenu>
    </ResponsiveDropdownContext.Provider>
  );
};

const ResponsiveDropdownContent = ({
  children,
  title,
  ...props
}: React.ComponentProps<typeof dropdown.DropdownMenuContent>) => {
  const { isMobile } = useResponsiveDropdownContext();
  const { className, ...restProps } = props;

  return isMobile
    ? (
      <drawer.DrawerContent {...restProps}>
        <drawer.DrawerHeader className="hidden">
          <drawer.DrawerTitle>
            {title}
          </drawer.DrawerTitle>
        </drawer.DrawerHeader>
        <div className={cn("flex flex-col gap-2 p-2 py-4", className)}>
          {children}
        </div>
      </drawer.DrawerContent>
    )
    : (
      <dropdown.DropdownMenuContent {...props}>
        {children}
      </dropdown.DropdownMenuContent>
    );
};

const ResponsiveDropdownItem = ({
  children,
  ...props
}: React.ComponentProps<typeof dropdown.DropdownMenuItem>) => {
  const { isMobile, setOpen } = useResponsiveDropdownContext();
  const { className, asChild, ...restProps } = props;

  return isMobile
    ? (
      <div
        {...restProps as React.HTMLAttributes<HTMLDivElement>}
        onClick={() => setOpen(false)}
        className={cn(
          "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
      >
        {children}
      </div>
    )
    : (
      <dropdown.DropdownMenuItem asChild={asChild} {...props}>
        {children}
      </dropdown.DropdownMenuItem>
    );
};

const ResponsiveDropdownTrigger = ({
  children,
  ...props
}: React.ComponentProps<typeof dropdown.DropdownMenuTrigger>) => {
  const { isMobile } = useResponsiveDropdownContext();

  return isMobile
    ? (
      <drawer.DrawerTrigger asChild>
        <Button variant="ghost" {...props}>{children}</Button>
      </drawer.DrawerTrigger>
    )
    : (
      <dropdown.DropdownMenuTrigger {...props}>
        {children}
      </dropdown.DropdownMenuTrigger>
    );
};

const ResponsiveDropdownSeparator = ({
  className,
  ...props
}: React.ComponentProps<typeof dropdown.DropdownMenuSeparator>) => {
  const { isMobile } = useResponsiveDropdownContext();

  return isMobile
    ? <dropdown.DropdownMenuSeparator className={cn(className)} {...props} />
    : <dropdown.DropdownMenuSeparator className={cn(className)} {...props} />;
};

export {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownSeparator,
  ResponsiveDropdownTrigger,
};
