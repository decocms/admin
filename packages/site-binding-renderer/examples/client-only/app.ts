import { createSiteClient, renderPath, ViewRegistry, ViewProps } from '../../src/index.js';

// --- Configuration ---
const MCP_URL = 'http://localhost:3000/mcp'; // Adjust to your MCP endpoint
const AUTH_TOKEN = ''; // Optional

// --- View Implementations ---

// Simple Header View
const HeaderView = (props: ViewProps) => {
    const { title, links } = props.data;
    const nav = links.map((l: any) => `<a href="${l.href}">${l.label}</a>`).join(' ');
    return `
    <header style="border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 20px;">
      <h1>${title}</h1>
      <nav>${nav}</nav>
    </header>
  `;
};

// Simple Post List View
const PostListView = (props: ViewProps) => {
    const { posts } = props.data;
    if (!posts || posts.length === 0) return '<p>No posts found.</p>';

    const list = posts.map((p: any) => `
    <article style="margin-bottom: 20px;">
      <h3>${p.title}</h3>
      <p>${p.excerpt}</p>
      <a href="/posts/${p.id}">Read more</a>
    </article>
  `).join('');

    return `<div>${list}</div>`;
};

// Simple Footer View
const FooterView = (props: ViewProps) => {
    const { copyright } = props.data;
    return `
    <footer style="border-top: 1px solid #ccc; padding-top: 10px; margin-top: 20px; color: #666;">
      <p>${copyright}</p>
    </footer>
  `;
};

// --- Setup ---

const client = createSiteClient({ baseUrl: MCP_URL, token: AUTH_TOKEN });
const registry = new ViewRegistry<string>();

// Register Views
registry.register('header', HeaderView);
registry.register('post-list', PostListView);
registry.register('footer', FooterView);

// --- App Logic ---

async function renderApp() {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = '<div class="loading">Loading...</div>';

    const path = window.location.pathname;

    try {
        const renderedBlocks = await renderPath({
            client,
            registry,
            path,
            // Optional page wrapper
            renderPage: (page, blocks) => {
                document.title = page.title || 'Site Binding Demo';
                return blocks.join('');
            }
        });

        if (renderedBlocks === null) {
            app.innerHTML = '<h1>404 - Page Not Found</h1>';
        } else {
            app.innerHTML = renderedBlocks;
        }
    } catch (err: any) {
        console.error(err);
        app.innerHTML = `<div class="error">Error: ${err.message}</div>`;
    }
}

// Handle Navigation
window.addEventListener('popstate', renderApp);

// Intercept clicks for SPA navigation
document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
        const href = target.getAttribute('href');
        if (href && href.startsWith('/')) {
            e.preventDefault();
            window.history.pushState({}, '', href);
            renderApp();
        }
    }
});

// Initial Render
renderApp();
