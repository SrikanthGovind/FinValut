import { buildSchema } from "type-graphql";
import { AuthResolver } from "../modules/auth/resolvers/AuthResolver";
import { UserResolver } from "../modules/user/resolvers/UserResolver";
import { BankAccountResolver } from "../modules/bank/resolvers/BankAccountResolver";
import { TransactionResolver } from "../modules/Transactions/resolvers/TransactionResolver";

const createGraphqlScheme = async () => {
  return await buildSchema({
    resolvers: [
      AuthResolver,
      UserResolver,
      BankAccountResolver,
      TransactionResolver,
    ],
    validate: true,
  });
};

export default createGraphqlScheme;