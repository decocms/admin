import { z } from 'zod';

// --- Content Types & Schemas ---

export const ContentSchema = z.object({
    id: z.string(),
    type: z.string(),
    // Content types can have arbitrary fields, but we enforce minimal structure
    // for the renderer to work with.
    // Specific content types will refine this.
}).passthrough();

export type Content = z.infer<typeof ContentSchema>;

export const ContentTypeSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    schema: z.any(), // Zod schema or JSON schema for the content type
});

export type ContentType = z.infer<typeof ContentTypeSchema>;

// --- Page & Blocks ---

export const BlockInputTypeSchema = z.enum(['static', 'dynamic']);

export const ContentBlockSchema = z.object({
    id: z.string(),
    contentType: z.string(),
    viewId: z.string().optional(), // Optional: override default view for this content type
    inputType: BlockInputTypeSchema,
    // If static, this is the direct input data.
    // If dynamic, this might be arguments for the tool call, or empty if the tool takes no args.
    input: z.record(z.any()).optional(),
});

export type ContentBlock = z.infer<typeof ContentBlockSchema>;

export const PageSchema = z.object({
    id: z.string(),
    path: z.string(),
    title: z.string().optional(),
    blocks: z.array(ContentBlockSchema),
    metadata: z.record(z.any()).optional(),
});

export type Page = z.infer<typeof PageSchema>;

// --- Views ---

export const ViewDescriptorSchema = z.object({
    id: z.string(),
    contentType: z.string(), // The content type this view is designed for
    description: z.string().optional(),
});

export type ViewDescriptor = z.infer<typeof ViewDescriptorSchema>;

// --- SITE Binding Tools ---

export const SITE_BINDING = {
    name: 'SITE',
    version: '0.1.0',
    tools: {
        // 1. Resolve pages by path
        GET_PAGE_CONTENT_FOR_PATH: {
            name: 'GET_PAGE_CONTENT_FOR_PATH',
            description: 'Get the page configuration and content blocks for a given path',
            inputSchema: z.object({
                path: z.string(),
            }),
            outputSchema: z.object({
                page: PageSchema.nullable(), // Null if not found (404)
            }),
            cache: {
                public: true,
                ttlSeconds: 300, // 5 minutes default
                vary: ['Accept-Language'],
            },
        },

        // 2. Enumerate content types
        LIST_CONTENT_TYPES: {
            name: 'LIST_CONTENT_TYPES',
            description: 'List all available content types',
            inputSchema: z.object({}),
            outputSchema: z.object({
                types: z.array(ContentTypeSchema),
            }),
            cache: {
                public: true,
                ttlSeconds: 3600, // 1 hour
            },
        },

        // 3. Read/Search content per type (Generic Interface)
        // Note: In a real implementation, you might have specific tools like GET_PRODUCT, SEARCH_POSTS, etc.
        // But the binding defines a pattern for these.
        // For the purpose of the binding definition object, we describe the *pattern* or core tools.
        // Here we define generic accessors if the system supports them, or specific ones can be discovered via LIST_CONTENT_TYPES.

        // We'll define a generic GET and SEARCH for the binding to be complete, 
        // but implementations might expose specific tools as well.
        GET_CONTENT: {
            name: 'GET_CONTENT',
            description: 'Get a specific content item by ID and type',
            inputSchema: z.object({
                type: z.string(),
                id: z.string(),
            }),
            outputSchema: z.object({
                item: ContentSchema.nullable(),
            }),
            cache: {
                public: true,
                ttlSeconds: 'forever', // Immutable if versioned, otherwise long TTL
            },
        },

        SEARCH_CONTENT: {
            name: 'SEARCH_CONTENT',
            description: 'Search for content items of a specific type',
            inputSchema: z.object({
                type: z.string(),
                query: z.string().optional(),
                filters: z.record(z.any()).optional(),
                limit: z.number().optional(),
                cursor: z.string().optional(),
            }),
            outputSchema: z.object({
                items: z.array(ContentSchema),
                nextCursor: z.string().optional(),
            }),
            cache: {
                public: true,
                ttlSeconds: 60, // Short TTL for search results
            },
        },

        // 4. Resolve views
        LIST_VIEWS: {
            name: 'LIST_VIEWS',
            description: 'List available views',
            inputSchema: z.object({}),
            outputSchema: z.object({
                views: z.array(ViewDescriptorSchema),
            }),
            cache: {
                public: true,
                ttlSeconds: 3600,
            },
        },

        // Note: GET_VIEW is often internal to the renderer (importing code), 
        // but if views are remote, we might need a tool. 
        // For this library, we assume views are resolved by the renderer via a registry,
        // but the *binding* allows discovering what views exist.
    },
};
