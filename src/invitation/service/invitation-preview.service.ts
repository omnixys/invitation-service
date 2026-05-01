import { PrismaService } from '../../prisma/prisma.service.js';
import { applyMapping } from '../../utils/apply-mapping.js';
import { mapColumns } from '../../utils/column-mapper.js';
import { Inject, Injectable } from '@nestjs/common';
import { FILE_STORAGE, type FileStorage } from '@omnixys/media';
import { TraceRunner } from '@omnixys/observability';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';

interface PreviewDto {
  key: string;
  type: string;
  eventId: string;
}

export interface InvitationPreviewResult {
  headers: string[];
  mapping: Record<string, string | null>;
  confidence: Record<string, number>;
  rows: Array<Record<string, unknown>>;
  errors: string[];
  duplicates: number[];
  total: number;
}

function toSearchString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return '';
}

@Injectable()
export class InvitationPreviewService {
  constructor(
    @Inject(FILE_STORAGE)
    private readonly storage: FileStorage,
    private readonly prisma: PrismaService,
  ) {}

  async preview(dto: PreviewDto): Promise<InvitationPreviewResult> {
    return TraceRunner.run('[SERVICE] preview', async () => {
      const buffer = await this.storage.get({ key: dto.key });

      let rows: Array<Record<string, unknown>> = [];
      let headers: string[] = [];

      /* ---------------- CSV ---------------- */
      if (dto.type === 'csv') {
        const content = buffer.toString('utf8');

        const parsed = Papa.parse<Record<string, unknown>>(content, {
          header: true,
          skipEmptyLines: true,
        });

        rows = parsed.data;
        headers = Object.keys(rows[0] ?? {});
      }

      /* ---------------- XLSX ---------------- */
      if (dto.type === 'xlsx') {
        const workbook = new ExcelJS.Workbook();

        const xlsxBuffer = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as Parameters<typeof workbook.xlsx.load>[0];

        await workbook.xlsx.load(xlsxBuffer);

        const sheet = workbook.worksheets[0];
        if (!sheet) {
          throw new Error('No sheet found');
        }

        /**
         * ExcelJS headers are 1-indexed → slice(1)
         */
        sheet.getRow(1).eachCell((cell) => {
          headers.push(cell.text);
        });

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) {
            return;
          }

          const obj: Record<string, unknown> = {};

          row.eachCell((cell, colNumber) => {
            const key = headers[colNumber - 1];
            if (key) {
              obj[key] = cell.value;
            }
          });

          rows.push(obj);
        });
      }

      /**
       * ---------------- COLUMN MAPPING ----------------
       */
      const { mapping, confidence } = mapColumns(headers);

      const mappedRows = applyMapping(rows, mapping);

      /**
       * ---------------- VALIDATION ----------------
       */
      const required = ['firstName', 'lastName'];
      const errors: string[] = [];

      mappedRows.forEach((row, i) => {
        required.forEach((field) => {
          if (!row[field]) {
            errors.push(`Row ${i + 2}: Missing ${field}`);
          }
        });
      });

      /**
       * ---------------- DUPLICATES ----------------
       */
      const duplicates: number[] = [];

      for (let i = 0; i < mappedRows.length; i++) {
        const r = mappedRows[i];

        const exists = await this.prisma.invitation.findFirst({
          where: {
            eventId: dto.eventId,
            firstName: toSearchString(r?.firstName),
            lastName: toSearchString(r?.lastName),
          },
        });

        if (exists) {
          duplicates.push(i);
        }
      }

      return {
        headers,
        mapping,
        confidence,
        rows: mappedRows.slice(0, 20),
        errors,
        duplicates,
        total: mappedRows.length,
      };
    });
  }
}
