export interface ApproveInvitationDTO {
  id: string;
  approve: boolean;
  actorId: string;
  seatId?: string;
  activeEventId?: string;
}
