import { ArgsType, Field } from "type-graphql";
import { IsEmail, Length, Matches, MinLength } from "class-validator";

@ArgsType()
export class CreateUserInput {
  @Field(() => String, { nullable: false })
  @Length(1, 100)
  firstName!: string;

  @Field(() => String, { nullable: false })
  @Length(1, 100)
  lastName!: string;

  @Field(() => String, { nullable: false })
  @IsEmail()
  email!: string;

  @Field(() => String, { nullable: false })
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
    {
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    }
  )
  password!: string;

  @Field(() => String, { nullable: false })
  @Length(10, 20)
  phone!: string;
}