export interface ApproveInvitationDTO {
  id: string;
  approve: boolean;
  actorId: string;
  eventName: string;
  eventEndsAt: Date;
  seat?: string;
  seatId?: string;
}
