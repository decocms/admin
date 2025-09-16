import {
  DatatabasesRunSqlInput,
  IWorkspaceDB,
  IWorkspaceDBMeta,
} from "@deco/sdk/mcp";
import { DurableObject } from "cloudflare:workers";
import { Browsable } from "outerbase-browsable-do-enforced";
import type { Bindings } from "../utils/context.ts";

@Browsable()
export class WorkspaceDatabase extends DurableObject<Bindings>
  implements IWorkspaceDB {
  private sql: SqlStorage;

  constructor(
    // @ts-ignore: This is a workaround to fix the type error
    // deno-lint-ignore ban-types
    protected override ctx: DurableObjectState<{}>,
    protected override env: Bindings,
  ) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
  }

  meta(): IWorkspaceDBMeta {
    return { size: this.sql.databaseSize, [Symbol.dispose]: () => {} };
  }

  async recovery(dt: Date) {
    const bookmark = await this.ctx.storage.getBookmarkForTime(dt);
    this.ctx.storage.onNextSessionRestoreBookmark(bookmark);
    this.ctx.abort();
    return {
      [Symbol.dispose]: () => {},
    };
  }

  exec({ sql, params }: DatatabasesRunSqlInput) {
    return {
      result: [
        {
          results: this.sql.exec(sql, ...(params ?? [])).toArray(),
          success: true,
        },
      ],
      [Symbol.dispose]: () => {},
    };
  }
}
