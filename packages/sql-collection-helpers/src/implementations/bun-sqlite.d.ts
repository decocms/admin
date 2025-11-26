/**
 * Type declarations for bun:sqlite
 * This file provides minimal type definitions to avoid TypeScript errors
 * when the code is type-checked in non-Bun environments.
 */

declare module "bun:sqlite" {
  export class Database {
    constructor(filename: string);
    prepare(sql: string): {
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown | undefined;
      run(...params: unknown[]): { changes: number; lastInsertRowid: number };
    };
    query(sql: string): {
      all(...params: unknown[]): unknown[];
      get(...params: unknown[]): unknown | undefined;
    };
    exec(sql: string): void;
    close(): void;
  }
}
