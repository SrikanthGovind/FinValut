import { AuthChecker } from "type-graphql";
import { CAPABILITIES, hasAnyPermission, hasPermission } from "../permissions";
import { AuthContext } from "./authContext";

/**
 * type-graphql auth checker wired through the `authChecker` option in
 * buildSchema.
 *
 * Decorated fields pass one of three shapes:
 *   @Authorized()                                  any verified token
 *   @Authorized(CAPABILITIES.ACCOUNT_READ_ANY)     token's role must hold it
 *   @Authorized(A, B)                              any one of the two
 *
 * The strings are resolved through ROLE_CAPABILITIES rather than compared
 * against the role itself, so the decorator names a *permission*, not a
 * person. An unknown or forged role never matches, so this fails closed.
 *
 * Must stay an arrow function: type-graphql's AuthMiddleware branches on
 * `authChecker.prototype` to decide class vs function, and a `function`
 * declaration has a truthy prototype, which would make it try to instantiate
 * the checker as a class and blow up at runtime.
 */
export const authChecker: AuthChecker<AuthContext> = (
  { context },
  roles
): boolean => {
  const user = context?.user;
  if (!user) {
    return false;
  }

  if (roles.length === 0) {
    return true;
  }

  return hasAnyPermission(
    user.role,
    roles as unknown as (typeof CAPABILITIES)[keyof typeof CAPABILITIES][]
  );
};

export { CAPABILITIES, hasPermission, hasAnyPermission };
