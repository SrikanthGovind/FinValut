import { gql } from "@apollo/client";

/**
 * Every document here is written against the live schema produced by
 * `backend/src/loaders/graphql.loader.ts`.
 *
 * Two shapes of argument deserve attention, because type-graphql decides which
 * one you get:
 *
 *   - `@ArgsType()` inputs are *flattened* into individual arguments. That is
 *     why `login` takes `email`/`password` directly and why `cashDeposit`
 *     takes `accountId`/`amount` rather than a `data` object.
 *   - `@InputType()` inputs arrive as a single named argument. Only
 *     `updateBankAccountStatus` is one of these.
 *
 * Arguments declared `String! = "INR"` or `Int! = 50` on the server are bound
 * to *nullable* variables here and always given a concrete value. A nullable
 * variable is legal in a non-null position, and unlike `String!` it also
 * survives the server relaxing the argument to nullable.
 */

export const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    firstName
    lastName
    email
    phone
    dateOfBirth
    aadharNumber
    panNumber
    status
    role
    createdAt
    updatedAt
  }
`;

export const ACCOUNT_FIELDS = gql`
  fragment AccountFields on BankAccount {
    id
    accountNumber
    accountType
    balance
    currency
    branchCode
    ifscCode
    status
    openedAt
    closedAt
    userId
  }
`;

export const TRANSACTION_FIELDS = gql`
  fragment TransactionFields on Transaction {
    id
    referenceNumber
    transactionType
    status
    amount
    currency
    description
    fromAccountId
    toAccountId
    transactionDate
    channel
    tellerId
    approvedAt
    approvedById
    createdAt
    fromAccount {
      accountNumber
    }
    toAccount {
      accountNumber
    }
  }
`;

export const AUDIT_FIELDS = gql`
  fragment AuditFields on AuditLog {
    id
    actorId
    actorRole
    action
    outcome
    entityType
    entityId
    changes
    ipAddress
    reason
    createdAt
  }
`;

const AUTH_PAYLOAD = gql`
  fragment AuthPayloadFields on AuthPayload {
    message
    accessToken
    expiresAt
    user {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

/* ------------------------------------------------------------------ *
 * Authentication
 * ------------------------------------------------------------------ */

export const LOGIN = gql`
  ${AUTH_PAYLOAD}
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      ...AuthPayloadFields
    }
  }
`;

export const REGISTER = gql`
  ${AUTH_PAYLOAD}
  mutation Register(
    $firstName: String!
    $lastName: String
    $email: String!
    $password: String!
    $phone: String
  ) {
    register(
      firstName: $firstName
      lastName: $lastName
      email: $email
      password: $password
      phone: $phone
    ) {
      ...AuthPayloadFields
    }
  }
`;

/* ------------------------------------------------------------------ *
 * Users
 * ------------------------------------------------------------------ */

export const ME = gql`
  ${USER_FIELDS}
  query Me {
    me {
      ...UserFields
    }
  }
`;

export const GET_USERS = gql`
  ${USER_FIELDS}
  query GetUsers {
    getUsers {
      ...UserFields
    }
  }
`;

export const GET_USER = gql`
  ${USER_FIELDS}
  query GetUser($id: ID!) {
    getUser(id: $id) {
      ...UserFields
    }
  }
`;

export const UPDATE_PROFILE = gql`
  ${USER_FIELDS}
  mutation UpdateProfile(
    $firstName: String
    $lastName: String
    $phone: String
    $dateOfBirth: String
  ) {
    updateProfile(
      firstName: $firstName
      lastName: $lastName
      phone: $phone
      dateOfBirth: $dateOfBirth
    ) {
      ...UserFields
    }
  }
`;

export const CHANGE_PASSWORD = gql`
  ${USER_FIELDS}
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(
      currentPassword: $currentPassword
      newPassword: $newPassword
    ) {
      ...UserFields
    }
  }
`;

export const SET_USER_ROLE = gql`
  ${USER_FIELDS}
  mutation SetUserRole($userId: ID!, $role: String!) {
    setUserRole(userId: $userId, role: $role) {
      ...UserFields
    }
  }
`;

export const SET_USER_STATUS = gql`
  ${USER_FIELDS}
  mutation SetUserStatus($userId: ID!, $status: String!) {
    setUserStatus(userId: $userId, status: $status) {
      ...UserFields
    }
  }
`;

/* ------------------------------------------------------------------ *
 * Bank accounts
 * ------------------------------------------------------------------ */

export const MY_BANK_ACCOUNTS = gql`
  ${ACCOUNT_FIELDS}
  query MyBankAccounts {
    myBankAccounts {
      ...AccountFields
    }
  }
`;

export const GET_BANK_ACCOUNTS = gql`
  ${ACCOUNT_FIELDS}
  query GetBankAccounts {
    getBankAccounts {
      ...AccountFields
    }
  }
`;

export const GET_BANK_ACCOUNTS_BY_USER = gql`
  ${ACCOUNT_FIELDS}
  query GetBankAccountsByUser($userId: ID!) {
    getBankAccountsByUser(userId: $userId) {
      ...AccountFields
    }
  }
`;

export const CREATE_BANK_ACCOUNT = gql`
  ${ACCOUNT_FIELDS}
  mutation CreateBankAccount(
    $accountType: AccountType!
    $initialBalance: Float!
    $currency: String
    $accountNumber: String
  ) {
    createBankAccount(
      accountType: $accountType
      initialBalance: $initialBalance
      currency: $currency
      accountNumber: $accountNumber
    ) {
      ...AccountFields
    }
  }
`;

export const OPEN_ACCOUNT_FOR_CUSTOMER = gql`
  ${ACCOUNT_FIELDS}
  mutation OpenAccountForCustomer(
    $customerId: ID!
    $accountType: AccountType!
    $currency: String
  ) {
    openAccountForCustomer(
      customerId: $customerId
      accountType: $accountType
      currency: $currency
    ) {
      ...AccountFields
    }
  }
`;

export const UPDATE_ACCOUNT_STATUS = gql`
  ${ACCOUNT_FIELDS}
  mutation UpdateAccountStatus($data: UpdateBankAccountStatusInput!) {
    updateBankAccountStatus(data: $data) {
      ...AccountFields
    }
  }
`;

export const FREEZE_ACCOUNT = gql`
  ${ACCOUNT_FIELDS}
  mutation FreezeAccount($id: ID!) {
    freezeAccount(id: $id) {
      ...AccountFields
    }
  }
`;

export const UNFREEZE_ACCOUNT = gql`
  ${ACCOUNT_FIELDS}
  mutation UnfreezeAccount($id: ID!) {
    unfreezeAccount(id: $id) {
      ...AccountFields
    }
  }
`;

export const CLOSE_BANK_ACCOUNT = gql`
  ${ACCOUNT_FIELDS}
  mutation CloseBankAccount($id: ID!) {
    closeBankAccount(id: $id) {
      ...AccountFields
    }
  }
`;

/* ------------------------------------------------------------------ *
 * Transactions
 * ------------------------------------------------------------------ */

export const MY_TRANSACTIONS = gql`
  ${TRANSACTION_FIELDS}
  query MyTransactions {
    myTransactions {
      ...TransactionFields
    }
  }
`;

export const GET_TRANSACTIONS = gql`
  ${TRANSACTION_FIELDS}
  query GetTransactions {
    getTransactions {
      ...TransactionFields
    }
  }
`;

export const GET_TRANSACTIONS_BY_ACCOUNT = gql`
  ${TRANSACTION_FIELDS}
  query GetTransactionsByAccount($accountId: ID!) {
    getTransactionsByAccount(accountId: $accountId) {
      ...TransactionFields
    }
  }
`;

export const GET_USER_TRANSACTIONS = gql`
  ${TRANSACTION_FIELDS}
  query GetUserTransactions($userId: ID) {
    getUserTransactions(userId: $userId) {
      ...TransactionFields
    }
  }
`;

export const GET_PENDING_APPROVALS = gql`
  ${TRANSACTION_FIELDS}
  query GetPendingApprovals {
    getPendingApprovals {
      ...TransactionFields
    }
  }
`;

export const CREATE_TRANSACTION = gql`
  ${TRANSACTION_FIELDS}
  mutation CreateTransaction(
    $fromAccountId: ID
    $toAccountId: ID
    $transactionType: TransactionType!
    $amount: Float!
    $currency: String
    $description: String
  ) {
    createTransaction(
      fromAccountId: $fromAccountId
      toAccountId: $toAccountId
      transactionType: $transactionType
      amount: $amount
      currency: $currency
      description: $description
    ) {
      ...TransactionFields
    }
  }
`;

export const REVERSE_TRANSACTION = gql`
  ${TRANSACTION_FIELDS}
  mutation ReverseTransaction($id: ID!) {
    reverseTransaction(id: $id) {
      ...TransactionFields
    }
  }
`;

export const CASH_DEPOSIT = gql`
  ${TRANSACTION_FIELDS}
  mutation CashDeposit(
    $accountId: ID!
    $amount: Float!
    $tellerReference: String
    $description: String
  ) {
    cashDeposit(
      accountId: $accountId
      amount: $amount
      tellerReference: $tellerReference
      description: $description
    ) {
      ...TransactionFields
    }
  }
`;

export const CASH_WITHDRAWAL = gql`
  ${TRANSACTION_FIELDS}
  mutation CashWithdrawal(
    $accountId: ID!
    $amount: Float!
    $tellerReference: String
    $description: String
  ) {
    cashWithdrawal(
      accountId: $accountId
      amount: $amount
      tellerReference: $tellerReference
      description: $description
    ) {
      ...TransactionFields
    }
  }
`;

export const APPROVE_TRANSACTION = gql`
  ${TRANSACTION_FIELDS}
  mutation ApproveTransaction($id: ID!) {
    approveTransaction(id: $id) {
      ...TransactionFields
    }
  }
`;

export const REJECT_TRANSACTION = gql`
  ${TRANSACTION_FIELDS}
  mutation RejectTransaction($transactionId: ID!, $reason: String!) {
    rejectTransaction(transactionId: $transactionId, reason: $reason) {
      ...TransactionFields
    }
  }
`;

/* ------------------------------------------------------------------ *
 * Audit
 * ------------------------------------------------------------------ */

export const GET_AUDIT_LOGS = gql`
  ${AUDIT_FIELDS}
  query GetAuditLogs(
    $action: AuditAction
    $outcome: AuditOutcome
    $actorId: String
    $entityType: String
    $entityId: String
    $limit: Int
    $offset: Int
  ) {
    getAuditLogs(
      action: $action
      outcome: $outcome
      actorId: $actorId
      entityType: $entityType
      entityId: $entityId
      limit: $limit
      offset: $offset
    ) {
      ...AuditFields
    }
  }
`;

export const GET_FAILED_AUDIT_LOGS = gql`
  ${AUDIT_FIELDS}
  query GetFailedAuditLogs($limit: Int, $offset: Int) {
    getFailedAuditLogs(limit: $limit, offset: $offset) {
      ...AuditFields
    }
  }
`;

export const GET_AUDIT_LOGS_BY_ACTOR = gql`
  ${AUDIT_FIELDS}
  query GetAuditLogsByActor($actorId: String!, $limit: Int, $offset: Int) {
    getAuditLogsByActor(actorId: $actorId, limit: $limit, offset: $offset) {
      ...AuditFields
    }
  }
`;
