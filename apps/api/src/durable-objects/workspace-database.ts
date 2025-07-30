import { DurableObject } from "cloudflare:workers";
import { Bindings } from "../utils/context.ts";
import { DatatabasesRunSqlInput } from "@deco/sdk/mcp";

export class WorkspaceDatabase extends DurableObject {
  sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
  }

  exec({ sql, params }: DatatabasesRunSqlInput) {
    return {
      result: [{
        results: this.sql.exec(sql, ...(params ?? [])).toArray(),
        success: true,
      }],
    };
  }
}
