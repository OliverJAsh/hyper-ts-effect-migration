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

const a: M.Middleware<H.StatusOpen, H.ResponseEnded, never, void> = pipe(
  M.status(H.Status.OK),
  M.ichain(() => M.closeHeaders()),
  M.ichain(() => M.send("GOT a"))
);

const ExpressApp: HttpApp.Default<never, HttpServerRequest.HttpServerRequest> =
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest;
    const nodeRequest = NodeHttpServerRequest.toIncomingMessage(req);
    const nodeResponse = NodeHttpServerRequest.toServerResponse(req);

    console.log("RUN....");

    return yield* Effect.async<HttpServerResponse.HttpServerResponse>(
      (resume) => {
        nodeResponse.on("close", () => {
          console.log("CLOSING....");
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

        console.log("express");
        express()
          .get("/a", toRequestHandler(a))
          .use(((error, req, res, next) => {
            console.log("express error", { error });
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

// express()
//   // Express middlewares
//   // Note:  We could get rid of this if we're able to call hyper-ts route handlers/middlewares inside platform.
//   .get("/a", toRequestHandler(a))
//   // Finally, the platform handler
//   .use(handler)
//   .listen(3000, () =>
//     console.log("Express listening on port 3000. Use: GET /")
//   );
