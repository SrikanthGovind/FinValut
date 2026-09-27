import { buildSchema } from "type-graphql";
import { UserResolver } from "../modules/user/resolvers/UserResolver";
import { BankAccountResolver } from "../modules/bank/resolvers/BankAccountResolver";

const createGraphqlScheme = async () => {
  return await buildSchema({
    resolvers: [UserResolver, BankAccountResolver],
    validate: true,
  });
};

export default createGraphqlScheme;