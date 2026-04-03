export interface ApproveInvitationDTO {
  id: string;
  approve: boolean;
  actorId: string;
  eventName: string;
  seat?: string;
  seatId?: string;
}
