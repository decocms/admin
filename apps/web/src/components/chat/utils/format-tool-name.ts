/**
 * Formata o nome de uma ferramenta para exibição na interface
 * - Substitui underlines e hífens por espaços
 * - Adiciona espaços antes de letras maiúsculas (camelCase/PascalCase)
 * - Capitaliza a primeira letra de cada palavra
 * - Remove espaços extras
 */
export function formatToolName(toolName: string): string {
    return toolName
        .replace(/[_-]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([a-zA-Z])(\d)/g, '$1 $2')
        .replace(/(\d)([a-zA-Z])/g, '$1 $2')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .replace(/\s+/g, ' ')
        .trim();
} 