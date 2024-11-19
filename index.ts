import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerResponse,
} from "@effect/platform";
import { createServer } from "node:http";
import { NodeRuntime, NodeHttpServer } from "@effect/platform-node";
import { pipe, Effect, Layer } from "effect";
import * as H from "hyper-ts";
import * as M from "hyper-ts/Middleware";

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

const c: M.Middleware<H.StatusOpen, H.ResponseEnded, never, void> = pipe(
  M.status(H.Status.OK),
  M.ichain(() => M.closeHeaders()),
  M.ichain(() => M.send("C"))
);

const router = HttpRouter.empty.pipe(
  HttpRouter.get("/b", HttpServerResponse.text("b", { status: 200 })),
  HttpRouter.get("/c", HttpServerResponse.text("c", { status: 200 }))
);

const ServerLive = NodeHttpServer.layer(() => createServer(), { port: 3000 });
const app = pipe(
  router,
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
