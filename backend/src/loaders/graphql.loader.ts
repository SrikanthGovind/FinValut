import { buildSchema } from "type-graphql";
import { UserResolver } from "../modules/user/resolvers/UserResolver";
import { BankAccountResolver } from "../modules/bank/resolvers/BankAccountResolver";
import { TransactionResolver } from "../modules/Transactions/resolvers/TransactionResolver";

const createGraphqlScheme = async () => {
  return await buildSchema({
    resolvers: [UserResolver, BankAccountResolver, TransactionResolver],
    validate: true,
  });
};

export default createGraphqlScheme;