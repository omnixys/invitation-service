// Handles pure RSVP decision logic (no DB, no infra)
// This makes unit-testing simple and keeps application services clean.

import { InvitationStatus } from '../enums/invitation-status.enum.js';
import { RsvpChoice } from '../enums/rsvp-choice.enum.js';

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
    previousChoice: RsvpChoice | undefined,
    newChoice: RsvpChoice,
    hasReplyInput: boolean,
  ): RSVPDecision {
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
        needsContactDetails: hasReplyInput,
      };
    }

    // YES
    if (previousChoice === RsvpChoice.YES) {
      throw new Error('Invitation already accepted');
    }

    return {
      newChoice,
      newStatus: InvitationStatus.ACCEPTED,
      needsContactDetails: true,
    };
  }
}
