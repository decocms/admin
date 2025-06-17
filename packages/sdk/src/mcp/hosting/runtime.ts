export interface DefaultEnv extends Record<string, unknown> {
  DECO_CHAT_WORKSPACE: string;
  DECO_CHAT_BINDINGS: string;
}

export interface UserDefaultExport<TUserEnv extends Record<string, unknown>> {
  fetch?: (
    req: Request,
    env: TUserEnv,
    ctx: ExecutionContext,
  ) => Promise<Response>;
  scheduled?: (
    controller: ScheduledController,
    env: TUserEnv,
    ctx: ExecutionContext,
  ) => Promise<void>;
  email?: (
    message: ForwardableEmailMessage,
    env: TUserEnv,
    ctx: ExecutionContext,
  ) => Promise<void>;
}

const createBindings = <TEnv extends DefaultEnv>(env: TEnv) => {
  return env;
};

export const runtimeFn = <TEnv extends DefaultEnv>(
  userFns: UserDefaultExport<TEnv>,
) => {
  return {
    ...userFns,
    ...userFns.email
      ? {
        email: (
          message: ForwardableEmailMessage,
          env: TEnv,
          ctx: ExecutionContext,
        ) => {
          return userFns.email!(message, createBindings(env), ctx);
        },
      }
      : {},
    ...userFns.scheduled
      ? {
        scheduled: (
          controller: ScheduledController,
          env: TEnv,
          ctx: ExecutionContext,
        ) => {
          return userFns.scheduled!(controller, createBindings(env), ctx);
        },
      }
      : {},
    ...(userFns.fetch
      ? {
        fetch: (req: Request, env: TEnv, ctx: ExecutionContext) => {
          return userFns.fetch!(req, createBindings(env), ctx);
        },
      }
      : {}),
  };
};
