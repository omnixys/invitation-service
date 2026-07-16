import { InvitationType } from '../../prisma/generated/client.js';

export function shouldAutoApproveInvitation(
  approvalMode: string | null | undefined,
  type: InvitationType,
): boolean {
  return (
    approvalMode === 'AUTO' ||
    (approvalMode === 'AUTO_PUBLIC_ONLY' && type === InvitationType.PUBLIC) ||
    (approvalMode === 'AUTO_INVITE_ONLY' && type === InvitationType.PRIVATE)
  );
}

export function shouldAutoApprovePlusOnes(
  requireApprovalForPlusOnes: boolean | null | undefined,
): boolean {
  return requireApprovalForPlusOnes === false;
}
