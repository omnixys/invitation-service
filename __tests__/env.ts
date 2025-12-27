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

import 'dotenv/config';
import process from 'node:process';

export const env = {
  KC_URL: process.env.KC_URL ?? 'http://localhost:18080/auth',
  KC_REALM: process.env.KC_REALM ?? 'camunda-platform',
  OMNIXYS_ADMIN_USERNAME: process.env.OMNIXYS_ADMIN_USERNAME ?? 'admin',
  OMNIXYS_ADMIN_PASSWORD: process.env.OMNIXYS_ADMIN_PASSWORD ?? 'p',
  OMNIXYS_USER_USERNAME: process.env.OMNIXYS_USER_USERNAME ?? 'user',
  OMNIXYS_USER_PASSWORD: process.env.OMNIXYS_USER_PASSWORD ?? 'p',
} as const;
