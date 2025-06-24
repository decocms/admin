import { withRuntime } from "@deco/workers-runtime";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
    return c.json({ message: "Hello World" });
});

export default withRuntime({
    fetch: app.fetch,
});