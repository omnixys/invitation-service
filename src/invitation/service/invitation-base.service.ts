// TODO resolve eslint

import type { Invitation } from '../../prisma/generated/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { NotFoundException } from '@nestjs/common';
import { OmnixysLogger, ScopedLogger } from '@omnixys/logger';

/**
 * @file Gemeinsame Basisklasse für Inventory-Read/Write-Services:
 *  - OTel-Span-Helfer
 *  - Hilfsfunktionen (z. B. Rollen auflösen)
 *
 *  Keine Business-Methoden – nur shared Infrastruktur.
 */
export abstract class InvitationBaseService {
  /** OpenTelemetry tracer instance. */

  /** Logger service wrapper. */
  protected readonly loggerPlusService: OmnixysLogger;

  /** Local logger instance. */
  protected readonly logger: ScopedLogger;

  protected readonly prismaService: PrismaService;

  protected constructor(loggerPlusService: OmnixysLogger, prismaService: PrismaService) {
    this.loggerPlusService = loggerPlusService;
    this.logger = loggerPlusService.log(this.constructor.name);
    this.prismaService = prismaService;
  }

  protected async ensureExists(id: string): Promise<Invitation> {
    const found = await this.prismaService.invitation.findUnique({
      where: { id },
    });
    if (!found) {
      throw new NotFoundException('Invitation not found');
    }
    return found;
  }
}
