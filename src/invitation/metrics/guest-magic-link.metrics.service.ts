import { Injectable } from '@nestjs/common';
import type { GuestMagicLinkChannel } from '@omnixys/contracts-ts';

@Injectable()
export class GuestMagicLinkMetricsService {
  private total = 0;
  private dispatched = 0;
  private readonly byResult: Record<string, number> = {};
  private readonly byChannel: Record<GuestMagicLinkChannel, number> = {
    EMAIL: 0,
    WHATSAPP: 0,
  };

  record(result: string, channel?: GuestMagicLinkChannel): void {
    this.total += 1;
    this.byResult[result] = (this.byResult[result] ?? 0) + 1;
    if (channel) {
      this.byChannel[channel] += 1;
    }
    if (result === 'DISPATCH_QUEUED') {
      this.dispatched += 1;
    }
  }

  snapshot() {
    return {
      total: this.total,
      dispatched: this.dispatched,
      byResult: { ...this.byResult },
      byChannel: { ...this.byChannel },
    };
  }
}
