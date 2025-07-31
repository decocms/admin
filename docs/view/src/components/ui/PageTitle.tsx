import React from "react";
import { MarkdownCopySelect } from "./MarkdownCopySelect";

export interface PageTitleProps {
  breadcrumb?: string;
  title: string;
  description?: string;
  markdownPath?: string;
}

export function PageTitle({
  breadcrumb,
  title,
  description,
  markdownPath,
}: PageTitleProps) {
  return (
    <div className="flex flex-col mb-6">
      {/* Breadcrumb Section */}
      {breadcrumb && (
        <div className="text-sm text-primary font-normal">{breadcrumb}</div>
      )}

      {/* Title Section with Copy Button */}
      <div className="flex items-start justify-between pb-2 pt-2 gap-4">
        <h1 className="text-3xl font-bold leading-[1.25] text-foreground flex-1 min-w-0">
          {title}
        </h1>
        <MarkdownCopySelect markdownPath={markdownPath} />
      </div>

      {/* Description Section */}
      {description && (
        <div className="pb-6 pt-0">
          <p className="text-lg font-normal leading-[1.625] text-foreground0">
            {description}
          </p>
        </div>
      )}
    </div>
  );
}
