// TODO resolve eslint

import type { LoggerPlus } from '../../logger/logger-plus.js';
import type { LoggerPlusService } from '../../logger/logger-plus.service.js';
import { Invitation } from '../../prisma/generated/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { NotFoundException } from '@nestjs/common';
import type { Tracer } from '@opentelemetry/api';
import { trace } from '@opentelemetry/api';

/**
 * @file Gemeinsame Basisklasse für Inventory-Read/Write-Services:
 *  - OTel-Span-Helfer
 *  - Hilfsfunktionen (z. B. Rollen auflösen)
 *
 *  Keine Business-Methoden – nur shared Infrastruktur.
 */
export abstract class InvitationBaseService {
  /** OpenTelemetry tracer instance. */
  protected readonly tracer: Tracer;

  /** Logger service wrapper. */
  protected readonly loggerPlusService: LoggerPlusService;

  /** Local logger instance. */
  protected readonly logger: LoggerPlus;

  protected readonly prismaService: PrismaService;

  protected constructor(loggerPlusService: LoggerPlusService, prismaService: PrismaService) {
    this.tracer = trace.getTracer(this.constructor.name);
    this.loggerPlusService = loggerPlusService;
    this.logger = loggerPlusService.getLogger(this.constructor.name);
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
