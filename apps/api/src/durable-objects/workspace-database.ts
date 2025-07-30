import { DurableObject } from "cloudflare:workers";
import { Bindings } from "../utils/context.ts";
import { DatatabasesRunSqlInput, IWorkspaceDB } from "@deco/sdk/mcp";

export class WorkspaceDatabase extends DurableObject implements IWorkspaceDB {
  private sql: SqlStorage;

  constructor(
    protected override ctx: DurableObjectState,
    protected override env: Bindings,
  ) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
  }

  exec({ sql, params }: DatatabasesRunSqlInput) {
    try {
      return {
        result: [{
          results: this.sql.exec(sql, ...(params ?? [])).toArray(),
          success: true,
        }],
        [Symbol.dispose]: () => {},
      };
    } catch (err) {
      console.log(sql, params?.length);
      throw err;
    }
  }
}
