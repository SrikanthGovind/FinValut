import { gql } from "@apollo/client";

export const GET_USERS = gql`
  query GetUsers {
    getUsers {
      id
      firstName
      lastName
      email
      status
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($data: CreateUserInput!) {
    createUser(data: $data)
  }
`;

export const CREATE_BANK_ACCOUNT = gql`
  mutation CreateBankAccount(
    $accountType: AccountType!
    $initialBalance: Float!
    $currency: String
    $userId: ID!
  ) {
    createBankAccount(
      accountType: $accountType
      initialBalance: $initialBalance
      currency: $currency
      userId: $userId
    ) {
      id
      accountNumber
      branchCode
      ifscCode
    }
  }
`;