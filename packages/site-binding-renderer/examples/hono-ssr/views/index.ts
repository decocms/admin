import { ViewProps } from '../../../src/index.js';

export const HeaderView = (props: ViewProps) => {
  const { title = 'My Site', links = [] } = props.data || {};
  const nav = links.map((l: any) => `<a href="${l.href}">${l.label}</a>`).join(' ');
  return `
    <header style="background: #333; color: white; padding: 1rem;">
      <h1>${title}</h1>
      <nav>${nav || 'No navigation'}</nav>
    </header>
  `;
};

export const PostListView = (props: ViewProps) => {
  const { posts = [], html = '' } = props.data || {};

  // If it's an HTML block, just render the HTML
  if (html) {
    return `<div>${html}</div>`;
  }

  // Otherwise render as post list
  const items = posts.map((p: any) => `<li><strong>${p.title}</strong>: ${p.body}</li>`).join('');
  return `<ul>${items || '<li>No posts</li>'}</ul>`;
};

export const FooterView = (props: ViewProps) => {
  const { copyright = '© 2024 My Site' } = props.data || {};
  return `
    <footer style="background: #333; color: white; padding: 20px; margin-top: 40px;">
      <p>${copyright}</p>
    </footer>
  `;
};
