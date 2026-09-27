import "reflect-metadata";

import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import createGraphqlScheme from "./loaders/graphql.loader"
import { initializeDatabase } from "./loaders/database.loader";
import { authContext } from "./middleware/authContext";

dotenv.config();

async function startServer() {

  await initializeDatabase();

  const schema =await createGraphqlScheme()

  const server = new ApolloServer({ schema });
  await server.start();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: authContext,
    })
  );

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server ready at http://localhost:${PORT}/graphql`);
  });
}

startServer().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
