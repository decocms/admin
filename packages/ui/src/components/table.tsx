"use client";

import * as React from "react";

import { cn } from "@deco/ui/lib/utils.ts";

// Polymorphic component types
type AsProp<C extends React.ElementType> = {
  as?: C;
};

type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

type PolymorphicComponentProp<
  C extends React.ElementType,
  RequiredProps = Record<PropertyKey, never>
> = React.PropsWithChildren<RequiredProps & AsProp<C>> &
  Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, RequiredProps>>;

function Table<C extends React.ElementType = "table">({
  as,
  className,
  ...props
}: PolymorphicComponentProp<C, { className?: string }>) {
  const Component = as || "table";
  
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <Component
        data-slot="table"
        className={cn("table w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader<C extends React.ElementType = "thead">({
  as,
  className,
  ...props
}: PolymorphicComponentProp<C, { className?: string }>) {
  const Component = as || "thead";
  
  return (
    <Component
      data-slot="table-header"
      className={cn("table-header-group [&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody<C extends React.ElementType = "tbody">({
  as,
  className,
  ...props
}: PolymorphicComponentProp<C, { className?: string }>) {
  const Component = as || "tbody";
  
  return (
    <Component
      data-slot="table-body"
      className={cn("table-row-group [&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter<C extends React.ElementType = "tfoot">({
  as,
  className,
  ...props
}: PolymorphicComponentProp<C, { className?: string }>) {
  const Component = as || "tfoot";
  
  return (
    <Component
      data-slot="table-footer"
      className={cn(
        "table-footer-group bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow<C extends React.ElementType = "tr">({
  as,
  className,
  ...props
}: PolymorphicComponentProp<C, { className?: string }>) {
  const Component = as || "tr";
  
  return (
    <Component
      data-slot="table-row"
      className={cn(
        "table-row hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
}

function TableHead<C extends React.ElementType = "th">({
  as,
  className,
  ...props
}: PolymorphicComponentProp<C, { className?: string }>) {
  const Component = as || "th";
  
  return (
    <Component
      data-slot="table-head"
      className={cn(
        "table-cell text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCell<C extends React.ElementType = "td">({
  as,
  className,
  ...props
}: PolymorphicComponentProp<C, { className?: string }>) {
  const Component = as || "td";
  
  return (
    <Component
      data-slot="table-cell"
      className={cn(
        "table-cell p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption<C extends React.ElementType = "caption">({
  as,
  className,
  ...props
}: PolymorphicComponentProp<C, { className?: string }>) {
  const Component = as || "caption";
  
  return (
    <Component
      data-slot="table-caption"
      className={cn("table-caption text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
