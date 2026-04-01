"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({
  className,
  ref,
  ...props
}: React.ComponentProps<"ul"> & { ref?: React.Ref<HTMLUListElement> }) {
  return (
    <ul
      ref={ref}
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
}

function PaginationItem({
  className,
  ref,
  ...props
}: React.ComponentProps<"li"> & { ref?: React.Ref<HTMLLIElement> }) {
  return <li ref={ref} className={cn("", className)} {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"button">;

function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({
          variant: isActive ? "outline" : "ghost",
          size,
        }),
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children">) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1 pl-2.5", className)}
      aria-label="Go to previous page"
      {...props}
    >
      <ChevronLeft className="size-4" />
      <span>Previous</span>
    </Button>
  );
}

function PaginationNext({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children">) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1 pr-2.5", className)}
      aria-label="Go to next page"
      {...props}
    >
      <span>Next</span>
      <ChevronRight className="size-4" />
    </Button>
  );
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
