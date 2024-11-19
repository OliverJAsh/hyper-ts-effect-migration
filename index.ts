import {
  HttpApp,
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform";
import { createServer } from "node:http";
import { toRequestHandler } from "hyper-ts/express";
import {
  NodeRuntime,
  NodeHttpServer,
  NodeHttpServerRequest,
} from "@effect/platform-node";
import { pipe, Effect, Layer } from "effect";
import * as H from "hyper-ts";
import * as M from "hyper-ts/Middleware";
import express, { ErrorRequestHandler } from "express";
import { Task } from "fp-ts/lib/Task";

const delayTask: (ms: number) => Task<void> = (ms) => () =>
  new Promise((res) => setTimeout(res, ms));

const a: M.Middleware<H.StatusOpen, H.ResponseEnded, never, void> = pipe(
  M.status(H.Status.OK),
  M.ichain(() => M.closeHeaders()),
  M.ichain(() => M.send("GOT a"))
);

const delayM: M.Middleware<H.StatusOpen, H.ResponseEnded, never, void> = pipe(
  M.fromTask<void, H.StatusOpen, never>(delayTask(5000)),
  M.ichain(() => M.status(H.Status.OK)),
  M.ichain(() => M.closeHeaders()),
  M.ichain(() => M.send("GOT delay"))
);

const ExpressApp: HttpApp.Default<never, HttpServerRequest.HttpServerRequest> =
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest;
    const nodeRequest = NodeHttpServerRequest.toIncomingMessage(req);
    const nodeResponse = NodeHttpServerRequest.toServerResponse(req);

    return yield* Effect.async<HttpServerResponse.HttpServerResponse>(
      (resume) => {
        nodeResponse.on("close", () => {
          resume(
            Effect.succeed(
              HttpServerResponse.empty({
                status: nodeResponse.writableFinished
                  ? nodeResponse.statusCode
                  : 499,
              })
            )
          );
        });

        express()
          .get("/a", toRequestHandler(a))
          .get("/delay", toRequestHandler(delayM))
          .use(((error, req, res, next) => {
            if (
              error instanceof Error &&
              "code" in error &&
              error.code === "ERR_HTTP_HEADERS_SENT"
            ) {
              return next();
            }

            next(error);
          }) satisfies ErrorRequestHandler)(nodeRequest, nodeResponse);
      }
    );
  });

const router = HttpRouter.empty.pipe(
  HttpRouter.get("/b", HttpServerResponse.text("Got b", { status: 200 })),
  HttpRouter.get("/c", HttpServerResponse.text("Got c", { status: 200 }))
);

const ServerLive = NodeHttpServer.layer(() => createServer(), { port: 3000 });
const app = pipe(
  router,
  Effect.catchTag("RouteNotFound", () => ExpressApp),
  HttpServer.serve(HttpMiddleware.logger),
  HttpServer.withLogAddress,
  Layer.provide(ServerLive)
);

NodeRuntime.runMain(Layer.launch(app));
