export interface CreateTicketDTO {
  eventId: string;
  invitationId: string;
  guestProfileId?: string;
  seatId?: string;
  actorId: string;
}
