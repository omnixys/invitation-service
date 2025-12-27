/**
 * @license GPL-3.0-or-later
 * Copyright (C) 2025 Caleb Gyamfi - Omnixys Technologies
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * For more information, visit <https://www.gnu.org/licenses/>.
 */

import type { User } from '../../src/authentication/models/entitys/user.entity';
import type { SignUpPayload } from '../../src/authentication/models/payloads/sign-in.payload';
import type { SuccessPayload } from '../../src/authentication/models/payloads/success.payload';
import type { TokenPayload } from '../../src/authentication/models/payloads/token.payload';

// shared between PayloadMap and VariableMap
export type GraphQLOperationKey =
  | 'login'
  | 'refresh'
  | 'logout'
  | 'adminSignUp'
  | 'guestSignIn'
  | 'updateUser'
  | 'adminUpdateUser'
  | 'changeUserPassword'
  | 'deleteUser'
  | 'assignRealmRole'
  | 'removeRealmRole'
  | 'changeMyPassword'
  | 'updateMyProfile'
  | 'sendPasswordResetEmail'
  | 'getById'
  | 'getByUsername'
  | 'getUsers'
  | 'me'
  | 'meByToken';

/**
 * ---------------------------------------
 * GraphQL → Return type mapping
 * ---------------------------------------
 */
export interface PayloadMap extends Record<GraphQLOperationKey, unknown> {
  login: TokenPayload;
  refresh: TokenPayload;
  logout: SuccessPayload;
  adminSignUp: TokenPayload;
  guestSignIn: SignUpPayload;

  updateUser: boolean;
  adminUpdateUser: boolean;
  changeUserPassword: boolean;
  deleteUser: boolean;
  assignRealmRole: boolean;
  removeRealmRole: boolean;

  changeMyPassword: SuccessPayload;
  updateMyProfile: SuccessPayload;
  sendPasswordResetEmail: SuccessPayload;

  getById: User;
  getByUsername: User;
  getUsers: User[];
  me: User;
  meByToken: User;
}

/* ----------------------------------------------
 * VariableMap → Connects operation name to variable type
 * (used by gqlRequest<T> generic inference)
 * ---------------------------------------------- */

export interface VariableMap extends Record<GraphQLOperationKey, unknown> {
  login: LoginVariables;
  refresh: RefreshVariables;
  logout: LogoutVariables;
  adminSignUp: AdminSignUpVariables;
  guestSignIn: GuestSignInVariables;

  updateUser: UpdateUserVariables;
  adminUpdateUser: UpdateUserVariables;
  changeUserPassword: ChangePasswordVariables;
  deleteUser: DeleteUserVariables;
  assignRealmRole: AssignRealmRoleVariables;
  removeRealmRole: RemoveRealmRoleVariables;

  changeMyPassword: ChangeMyPasswordVariables;
  updateMyProfile: UpdateMyProfileVariables;
  sendPasswordResetEmail: SendPasswordResetEmailVariables;

  getById: GetByIdVariables;
  getByUsername: GetByUsernameVariables;
  getUsers: never; // no vars
  me: never; // no vars
  meByToken: never; // no vars
}

/* ----------------------------------------------
 * GraphQL Operation Variable Types
 * Used with gqlRequest<T> in E2E tests.
 * ---------------------------------------------- */

/**
 * Authentication → Login
 */
export interface LoginVariables {
  input: {
    username: string;
    password: string;
  };
}

/**
 * Authentication → Refresh Token
 */
export interface RefreshVariables {
  input: {
    refreshToken: string;
  };
}

/**
 * Authentication → Logout
 */
export interface LogoutVariables {
  input?: {
    refreshToken?: string;
  };
}

/**
 * Authentication → Admin Sign-Up
 */
export interface AdminSignUpVariables {
  input: {
    email: string;
    username: string;
    password: string;
    realmRoles?: string[];
  };
}

/**
 * Authentication → Guest Sign-In
 */
export interface GuestSignInVariables {
  input: {
    email: string;
    eventCode: string;
  };
}

/**
 * User → Update
 */
export interface UpdateUserVariables {
  id: string;
  input: {
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    enabled?: boolean;
  };
}

/**
 * User → Change Password
 */
export interface ChangePasswordVariables {
  id: string;
  input: {
    currentPassword: string;
    newPassword: string;
  };
}

/**
 * User → Assign Realm Role
 */
export interface AssignRealmRoleVariables {
  id: string;
  roleName: string;
}

/**
 * User → Remove Realm Role
 */
export interface RemoveRealmRoleVariables {
  id: string;
  roleName: string;
}

/**
 * User → Delete User
 */
export interface DeleteUserVariables {
  id: string;
}

/**
 * Me → Change My Password
 */
export interface ChangeMyPasswordVariables {
  input: {
    currentPassword: string;
    newPassword: string;
  };
}

/**
 * Me → Update My Profile
 */
export interface UpdateMyProfileVariables {
  input: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
  };
}

/**
 * Me → Send Password Reset
 */
export interface SendPasswordResetEmailVariables {
  email: string;
}

/**
 * User → Query by ID
 */
export interface GetByIdVariables {
  id: string;
}

/**
 * User → Query by Username
 */
export interface GetByUsernameVariables {
  username: string;
}
