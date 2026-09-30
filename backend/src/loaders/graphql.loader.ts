import { buildSchema } from "type-graphql";
import { AuthResolver } from "../modules/auth/resolvers/AuthResolver";
import { UserResolver } from "../modules/user/resolvers/UserResolver";
import { BankAccountResolver } from "../modules/bank/resolvers/BankAccountResolver";
import { TransactionResolver } from "../modules/Transactions/resolvers/TransactionResolver";
import { TellerResolver } from "../modules/teller/resolvers/TellerResolver";
import { ManagerResolver } from "../modules/manager/resolvers/ManagerResolver";
import { AuditLogResolver } from "../modules/audit/resolvers/AuditLogResolver";
import { authChecker } from "../middleware/authChecker";

const createGraphqlScheme = async () => {
  return await buildSchema({
    resolvers: [
      AuthResolver,
      UserResolver,
      BankAccountResolver,
      TransactionResolver,
      TellerResolver,
      ManagerResolver,
      AuditLogResolver,
    ],
    authChecker,
    validate: true,
  });
};

export default createGraphqlScheme;
