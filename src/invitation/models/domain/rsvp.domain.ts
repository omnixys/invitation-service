// Handles pure RSVP decision logic (no DB, no infra)
// This makes unit-testing simple and keeps application services clean.

import {
  InvitationStatus,
  RsvpChoice,
} from '../../../prisma/generated/client.js';
import { RsvpAlreadyAcceptedException } from '@omnixys/shared';

export interface RSVPDecision {
  newChoice: RsvpChoice;
  newStatus: InvitationStatus;
  needsContactDetails: boolean;
}

export class RsvpDomain {
  /**
   * Computes the new RSVP state and whether user must submit contact data.
   */
  static decide(
    previousChoice: RsvpChoice | undefined | null,
    newChoice: RsvpChoice,
    hasContactDetails: boolean,
  ): RSVPDecision {
    if (previousChoice === newChoice) {
      if (newChoice === RsvpChoice.YES) {
        throw new RsvpAlreadyAcceptedException();
      } else if (newChoice === RsvpChoice.NO) {
                    throw new Error('Already declined');

      } 
    }

    if (newChoice === RsvpChoice.NO) {
      return {
        newChoice,
        newStatus: InvitationStatus.DECLINED,
        needsContactDetails: false,
      };
    }

    if (newChoice === RsvpChoice.MAYBE) {
      return {
        newChoice,
        newStatus: InvitationStatus.PENDING,
        needsContactDetails: false,
      };
    }

    return {
      newChoice,
      newStatus: InvitationStatus.ACCEPTED,
      needsContactDetails: !!hasContactDetails,
    };
  }
}
