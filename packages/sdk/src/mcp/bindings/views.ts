import { z } from 'zod';
import type { Binder } from '../index.ts';

const listViewsSchema = z.object({
  views: z.array(
    z.object({
      title: z.string(),
      icon: z.string(),
      url: z.string(),
    }),
  ),
});

export const VIEW_BINDING_SCHEMA = [
  {
    name: 'DECO_CHAT_VIEWS_LIST' as const,
    inputSchema: z.any(),
    outputSchema: listViewsSchema,
  },
] as const satisfies Binder;
