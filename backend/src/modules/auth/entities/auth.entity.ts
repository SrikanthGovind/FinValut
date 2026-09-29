import { Field, GraphQLISODateTime, ObjectType } from "type-graphql";
import { User } from "../../user/entities/user.entity";

@ObjectType({ description: "Authentication result returned after register/login" })
export class AuthPayload {
  @Field(() => String, { description: "Success message for the operation" })
  message!: string;

  @Field(() => String, { description: "Signed JWT access token" })
  accessToken!: string;

  @Field(() => GraphQLISODateTime, { description: "Token expiry time" })
  expiresAt!: Date;

  @Field(() => User, { description: "Authenticated user" })
  user!: User;
}
