import type { QuickJSContext, QuickJSHandle } from "quickjs-emscripten-core";
import { toQuickJS } from "../utils/to-quickjs.ts";

export interface FetchBuiltin {
  [Symbol.dispose]: () => void;
}

export function installFetch(ctx: QuickJSContext): FetchBuiltin {
  const handles: QuickJSHandle[] = [];

  // Create Response class
  const ResponseClass = ctx.newFunction(
    "Response",
    (body?: QuickJSHandle, init?: QuickJSHandle) => {
      try {
        const responseObj = ctx.newObject();
        handles.push(responseObj);

        // Parse body
        let bodyText = "";
        if (body && body !== ctx.null && body !== ctx.undefined) {
          bodyText = String(ctx.dump(body));
        }

        // Parse init options
        let status = 200;
        let statusText = "OK";
        let _headers: Record<string, string> = {};

        if (init && init !== ctx.null && init !== ctx.undefined) {
          const initObj = ctx.dump(init) as Record<string, unknown>;
          if (typeof initObj.status === "number") {
            status = initObj.status;
          }
          if (typeof initObj.statusText === "string") {
            statusText = initObj.statusText;
          }
          if (initObj.headers && typeof initObj.headers === "object") {
            _headers = initObj.headers as Record<string, string>;
          }
        }

        // Set response properties
        ctx.setProp(responseObj, "status", ctx.newNumber(status));
        ctx.setProp(responseObj, "statusText", ctx.newString(statusText));
        ctx.setProp(
          responseObj,
          "ok",
          status >= 200 && status < 300 ? ctx.true : ctx.false,
        );
        ctx.setProp(responseObj, "body", toQuickJS(ctx, bodyText));

        // Add text() method
        const textMethod = ctx.newFunction("text", () => {
          const deferredPromise = ctx.newPromise();
          deferredPromise.resolve(toQuickJS(ctx, bodyText));
          return deferredPromise.handle;
        });
        handles.push(textMethod);
        ctx.setProp(responseObj, "text", textMethod);

        // Add json() method
        const jsonMethod = ctx.newFunction("json", () => {
          const deferredPromise = ctx.newPromise();
          try {
            const parsed = JSON.parse(bodyText);
            deferredPromise.resolve(toQuickJS(ctx, parsed));
          } catch (error) {
            deferredPromise.reject(toQuickJS(ctx, String(error)));
          }
          return deferredPromise.handle;
        });
        handles.push(jsonMethod);
        ctx.setProp(responseObj, "json", jsonMethod);

        return responseObj;
      } finally {
        if (body) body.dispose();
        if (init) init.dispose();
      }
    },
  );
  handles.push(ResponseClass);

  // Create fetch function
  const fetchFn = ctx.newFunction(
    "fetch",
    (url: QuickJSHandle, options?: QuickJSHandle) => {
      const deferredPromise = ctx.newPromise();

      // Start async operation
      (async () => {
        try {
          const urlString = String(ctx.dump(url));
          const fetchOptions: RequestInit = {};

          if (options && options !== ctx.null && options !== ctx.undefined) {
            const optionsObj = ctx.dump(options) as Record<string, unknown>;

            if (optionsObj.method && typeof optionsObj.method === "string") {
              fetchOptions.method = optionsObj.method;
            }

            if (optionsObj.headers && typeof optionsObj.headers === "object") {
              fetchOptions.headers = optionsObj.headers as Record<
                string,
                string
              >;
            }

            if (optionsObj.body) {
              if (typeof optionsObj.body === "string") {
                fetchOptions.body = optionsObj.body;
              } else {
                fetchOptions.body = JSON.stringify(optionsObj.body);
              }
            }
          }

          // Perform the actual fetch
          const response = await fetch(urlString, fetchOptions);
          const responseText = await response.text();

          // Create Response object
          const responseObj = ctx.newObject();
          handles.push(responseObj);

          ctx.setProp(responseObj, "status", ctx.newNumber(response.status));
          ctx.setProp(
            responseObj,
            "statusText",
            ctx.newString(response.statusText),
          );
          ctx.setProp(responseObj, "ok", response.ok ? ctx.true : ctx.false);
          ctx.setProp(responseObj, "body", toQuickJS(ctx, responseText));

          // Add text() method
          const textMethod = ctx.newFunction("text", () => {
            const textDeferredPromise = ctx.newPromise();
            textDeferredPromise.resolve(toQuickJS(ctx, responseText));
            return textDeferredPromise.handle;
          });
          handles.push(textMethod);
          ctx.setProp(responseObj, "text", textMethod);

          // Add json() method
          const jsonMethod = ctx.newFunction("json", () => {
            const jsonDeferredPromise = ctx.newPromise();
            try {
              const parsed = JSON.parse(responseText);
              jsonDeferredPromise.resolve(toQuickJS(ctx, parsed));
            } catch (error) {
              jsonDeferredPromise.reject(toQuickJS(ctx, String(error)));
            }
            return jsonDeferredPromise.handle;
          });
          handles.push(jsonMethod);
          ctx.setProp(responseObj, "json", jsonMethod);

          deferredPromise.resolve(responseObj);
        } catch (error) {
          deferredPromise.reject(toQuickJS(ctx, String(error)));
        } finally {
          if (url) url.dispose();
          if (options) options.dispose();
          // Execute pending jobs to propagate the promise resolution
          ctx.runtime.executePendingJobs();
        }
      })();

      return deferredPromise.handle;
    },
  );
  handles.push(fetchFn);

  // Install fetch and Response in global scope
  ctx.setProp(ctx.global, "fetch", fetchFn);
  ctx.setProp(ctx.global, "Response", ResponseClass);

  return {
    [Symbol.dispose]() {
      handles.forEach((handle) => handle.dispose());
    },
  };
}
