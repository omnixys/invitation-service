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

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { LoggerPlusService } from '../../../src/logger/logger-plus.service.js';
import { env } from '../../env.js';
import type { GraphQLResponse } from '../../utils/graphql-client.js';
import { gqlRequest } from '../../utils/graphql-client.js';
import type { PayloadMap } from '../../utils/graphql-types.js';
import { createTestApp } from '../setup-e2e.js';
import type { INestApplication } from '@nestjs/common';

describe('👤 Authentication E2E - User Operations', () => {
  const loggerPlusService = new LoggerPlusService();
  const logger = loggerPlusService.getLogger('authentication-user');

  let app: INestApplication;
  let cookies: string[] = [];
  let accessToken: string | undefined = undefined;
  let authHeaders: Record<string, string> = {};

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;

    const loginQuery = `
      mutation {
        login(input: {
          username: "${env.OMNIXYS_USER_USERNAME}",
          password: "${env.OMNIXYS_USER_PASSWORD}"
        }) { accessToken }
      }
    `;

    const result: GraphQLResponse<Pick<PayloadMap, 'login'>> = await gqlRequest(
      app,
      'login',
      loginQuery,
    );

    expect(result.errors).toBeUndefined();
    accessToken = result.data?.login?.accessToken ?? undefined;
    expect(accessToken).toBeDefined();

    cookies = result.cookies ?? [];
    authHeaders = { Authorization: `Bearer ${accessToken}` };
    logger.log('🔑 User logged in successfully');
  });

  afterAll(async () => {});

  it('should query me()', async () => {
    const query = `query { me { id username email } }`;

    const result: GraphQLResponse<Pick<PayloadMap, 'me'>> = await gqlRequest(
      app,
      'me',
      query,
      undefined,
      authHeaders,
      cookies,
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.me?.username).toBeDefined();
    logger.log('🙋 me() successful');
  });

  it('should send password reset email', async () => {
    const mutation = `mutation { sendPasswordResetEmail { ok } }`;

    const result: GraphQLResponse<Pick<PayloadMap, 'sendPasswordResetEmail'>> =
      await gqlRequest(
        app,
        'sendPasswordResetEmail',
        mutation,
        undefined,
        authHeaders,
        cookies,
      );

    expect(result.errors ?? []).toHaveLength(0);
    expect(result.data?.sendPasswordResetEmail?.ok).toBe(true);
    logger.log('📨 sendPasswordResetEmail successful');
  });
});
