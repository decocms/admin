import { DurableObject } from "cloudflare:workers";
import * as context from "../utils/context.ts";
import {
  DatatabasesRunSqlInput,
  IWorkspaceDB,
  IWorkspaceDBMeta,
} from "@deco/sdk/mcp";
import { Browsable } from "@outerbase/browsable-durable-object";

@Browsable()
export class WorkspaceDatabase extends DurableObject implements IWorkspaceDB {
  private sql: SqlStorage;

  constructor(
    protected override ctx: DurableObjectState,
    protected override env: context.Bindings,
  ) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
  }

  meta(): IWorkspaceDBMeta {
    return { size: this.sql.databaseSize, [Symbol.dispose]: () => {} };
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
