import React from 'react';
import { Icon } from './Icon';
import { MarkdownCopySelect } from './MarkdownCopySelect';

export interface PageTitleProps {
  breadcrumb?: string;
  title: string;
  description?: string;
  markdownPath?: string;
}

export function PageTitle({ breadcrumb, title, description, markdownPath }: PageTitleProps) {
  return (
    <div className="flex flex-col gap-1 mb-6">
      {/* Breadcrumb and Copy Section */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {breadcrumb && (
            <div className="text-sm text-[#7f9300] font-normal leading-5">
              {breadcrumb}
            </div>
          )}
        </div>
        <MarkdownCopySelect markdownPath={markdownPath} />
      </div>
      
      {/* Title Section */}
      <div className="flex items-center gap-2.5 pb-2 pt-2">
        <h1 className="text-[30px] font-bold leading-[1.25] text-stone-800">
          {title}
        </h1>
      </div>

      {/* Description Section */}
      {description && (
        <div className="pb-6 pt-0">
          <p className="text-[16px] font-normal leading-[1.625] text-stone-800">
            {description}
          </p>
        </div>
      )}
    </div>
  );
} 