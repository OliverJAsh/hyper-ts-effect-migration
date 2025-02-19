import { HttpRouter, HttpServerResponse } from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect } from "effect";
import express from "express";
import { pipe } from "fp-ts/function";
import * as H from "hyper-ts";
import * as M from "hyper-ts/Middleware";
import { toRequestHandler } from "hyper-ts/express";

const a: M.Middleware<H.StatusOpen, H.ResponseEnded, never, void> = pipe(
  M.status(H.Status.OK),
  M.ichain(() => M.closeHeaders()),
  M.ichain(() => M.send("A"))
);

const b: M.Middleware<H.StatusOpen, H.ResponseEnded, never, void> = pipe(
  M.status(H.Status.OK),
  M.ichain(() => M.closeHeaders()),
  M.ichain(() => M.send("B"))
);

const b2 = HttpServerResponse.text("B2");
const router = HttpRouter.empty.pipe(
  HttpRouter.get("/b", HttpServerResponse.text("b", { status: 200 })),
  HttpRouter.get("/c", HttpServerResponse.text("c", { status: 200 }))
);
const handler = Effect.runSync(NodeHttpServer.makeHandler(router));

const c: M.Middleware<H.StatusOpen, H.ResponseEnded, never, void> = pipe(
  M.status(H.Status.OK),
  M.ichain(() => M.closeHeaders()),
  M.ichain(() => M.send("C"))
);

express()
  // Express middlewares
  // Note:  We could get rid of this if we're able to call hyper-ts route handlers/middlewares inside platform.
  .get("/a", toRequestHandler(a))
  // Finally, the platform handler
  .use(handler)
  .listen(3000, () =>
    console.log("Express listening on port 3000. Use: GET /")
  );
