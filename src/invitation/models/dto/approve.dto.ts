export interface ApproveInvitationDTO {
  id: string;
  approve: boolean;
  actorId: string;
  seatId?: string;
  locale?: string;
  activeEventId?: string;
}
